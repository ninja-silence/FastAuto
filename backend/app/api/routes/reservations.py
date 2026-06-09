import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import col, select

from app.api.dependencies.auth import CurrentUser, RedisDep, SessionDep
from app.core.config import settings
from app.crud import listings as listing_crud
from app.crud import reservations as res_crud
from app.crud import viewings as viewings_crud
from app.models.listings import Listing, ViewingBooking, ViewingWindow
from app.models.reservations import (
    CancelReason,
    OutcomeParty,
    Reservation,
    ReservationStatus,
)
from app.models.users import User
from app.schemas.reservations import BookViewingIn, DeclineIn, OutcomeIn, ReserveIn
from app.services.notifications import notification_service as notifications
from app.services.payments import yookassa_service as yk
from app.services.payments.errors import HoldCreationError
from app.services.reservations import reservation_service as svc
from app.services.sms.sms_service import SmsSendError, get_sms_service
from app.services.viewings import booking_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reservations", tags=["reservations"])

_REVEALED_STATES = (
    ReservationStatus.active,
    ReservationStatus.settling,
    ReservationStatus.completed,
)

_COOLDOWN_KEY = "reserve_cooldown:{buyer_id}"

_ACTIVE_FOR_DELAY = (ReservationStatus.active, ReservationStatus.settling)


def _refund_delay_seconds(cancel_count: int) -> int:
    tiers = settings.refund_delay_tiers
    return tiers[min(cancel_count, len(tiers) - 1)]


async def _safe_sms(phone: str | None, text: str) -> None:
    if not phone:
        return
    try:
        await get_sms_service().send(phone, text)
    except SmsSendError:
        logger.warning("reservation sms failed", extra={"event": "sms_failed"})


async def _for_party(
    session: SessionDep, reservation_id: uuid.UUID, user: CurrentUser
) -> Reservation:
    reservation = await res_crud.get(session, reservation_id)
    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    if user.id not in (reservation.buyer_id, reservation.seller_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    return reservation


def _return_url_for(reservation_id: uuid.UUID) -> str:
    return f"{settings.YOOKASSA_RETURN_URL}?reservation_id={reservation_id}"


@router.post("", status_code=status.HTTP_201_CREATED, response_model=None)
async def reserve(
    body: ReserveIn,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> dict[str, Any]:
    listing = (
        (
            await session.execute(
                select(Listing)
                .where(col(Listing.id) == body.listing_id)
                .with_for_update()
            )
        )
        .scalars()
        .first()
    )
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    window = None
    if body.window_id is not None:
        window = await listing_crud.get_window(session, body.window_id)
        if window is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Window not found")
    if listing.viewing_enabled and window is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Window selection is required for this listing",
        )

    existing = await res_crud.get_active_for_listing(session, listing.id)
    if existing is not None:
        if (
            existing.buyer_id == user.id
            and existing.status == ReservationStatus.pending_payment
        ):
            if existing.yk_payment_id is None:
                try:
                    hold = await yk.create_hold(
                        amount_rub=existing.deposit_amount,
                        description="Депозит за бронь автомобиля",
                        idempotence_key=f"{existing.id}:hold",
                        return_url=_return_url_for(existing.id),
                    )
                except HoldCreationError:
                    logger.exception(
                        "reservation hold recovery failed",
                        extra={"reservation_id": str(existing.id)},
                    )
                    raise HTTPException(
                        status.HTTP_502_BAD_GATEWAY,
                        "Payment provider unavailable",
                    ) from None
                existing.yk_payment_id = hold.id
                await session.commit()
                return {
                    "reservation_id": str(existing.id),
                    "payment_url": hold.confirmation_url,
                }
            payment = await yk.find_payment(existing.yk_payment_id)
            url = getattr(
                getattr(payment, "confirmation", None), "confirmation_url", None
            )
            return {"reservation_id": str(existing.id), "payment_url": url}
        raise HTTPException(status.HTTP_409_CONFLICT, "Listing already reserved")

    if await redis.exists(_COOLDOWN_KEY.format(buyer_id=user.id)):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Reservation cooldown active"
        )
    active_count = await res_crud.count_active_for_buyer(session, user.id)
    if active_count >= settings.MAX_ACTIVE_RESERVATIONS_PER_BUYER:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reservation limit reached")

    now = datetime.now(UTC)
    try:
        reservation = svc.build_reservation(buyer=user, listing=listing, now=now)
    except svc.ReservationValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from e

    if window is not None:
        try:
            booking_service.assert_window_eligible(
                listing_id=listing.id,
                window=window,
                hold_deadline=reservation.hold_deadline,
                now=now,
            )
        except booking_service.BookingError as e:
            raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e

    session.add(reservation)
    if window is not None:
        await session.flush()
        await viewings_crud.create_booking(
            session,
            reservation_id=reservation.id,
            listing_id=listing.id,
            buyer_id=user.id,
            window_id=window.id,
        )
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Listing or window already reserved"
        ) from e
    await session.refresh(reservation)

    try:
        hold = await yk.create_hold(
            amount_rub=reservation.deposit_amount,
            description="Депозит за бронь автомобиля",
            idempotence_key=f"{reservation.id}:hold",
            return_url=_return_url_for(reservation.id),
        )
    except HoldCreationError:
        booking = await viewings_crud.get_active_booking_for_reservation(
            session, reservation.id
        )
        if booking is not None:
            await viewings_crud.cancel_booking(booking)
        await svc.cancel(
            reservation,
            listing,
            reason=CancelReason.payment_abandoned,
            deps=svc.default_deps(),
        )
        await session.commit()
        logger.exception(
            "reservation hold creation failed",
            extra={"reservation_id": str(reservation.id)},
        )
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Payment provider unavailable"
        ) from None

    reservation.yk_payment_id = hold.id
    await session.commit()
    return {"reservation_id": str(reservation.id), "payment_url": hold.confirmation_url}


@router.get("/my", response_model=None)
async def my_reservations(user: CurrentUser, session: SessionDep) -> list[dict]:
    reservations = await res_crud.list_for_user(session, user.id)
    if not reservations:
        return []

    # Fetch active viewing bookings + windows for all reservations in one query
    res_ids = [r.id for r in reservations]
    bookings_stmt = (
        select(ViewingBooking, ViewingWindow)
        .join(ViewingWindow, ViewingBooking.window_id == ViewingWindow.id, isouter=True)
        .where(
            col(ViewingBooking.reservation_id).in_(res_ids),
            col(ViewingBooking.status) != "cancelled",
        )
    )
    rows = (await session.execute(bookings_stmt)).all()
    window_map: dict[uuid.UUID, dict] = {}
    for booking, window in rows:
        if booking.reservation_id not in window_map and window is not None:
            window_map[booking.reservation_id] = {
                "window_date": str(window.window_date),
                "time_from": str(window.time_from)[:5],
                "time_to": str(window.time_to)[:5],
            }

    result = []
    for r in reservations:
        data = r.model_dump()
        data.update(window_map.get(r.id, {"window_date": None, "time_from": None, "time_to": None}))
        result.append(data)
    return result


@router.get("/{reservation_id}", response_model=None)
async def get_reservation(
    reservation_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> dict[str, Any]:
    reservation = await _for_party(session, reservation_id, user)
    data = reservation.model_dump()
    if user.id == reservation.buyer_id and reservation.status in _REVEALED_STATES:
        seller = await session.get(User, reservation.seller_id)
        listing = await listing_crud.get(session, reservation.listing_id)
        data["seller_phone"] = seller.phone if seller else None
        data["sale_address"] = listing.sale_address if listing else None
    return data


@router.post("/{reservation_id}/book-viewing", response_model=None)
async def book_viewing(
    reservation_id: uuid.UUID,
    body: BookViewingIn,
    user: CurrentUser,
    session: SessionDep,
) -> dict[str, Any]:
    reservation = await _for_party(session, reservation_id, user)
    if user.id != reservation.buyer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    window = await listing_crud.get_window(session, body.window_id)
    if window is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    try:
        booking_service.assert_can_book(reservation, window, now=datetime.now(UTC))
    except booking_service.BookingError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e

    previous = await viewings_crud.get_active_booking_for_reservation(
        session, reservation.id
    )
    if previous is not None:
        await viewings_crud.cancel_booking(previous)
        await session.flush()

    await viewings_crud.create_booking(
        session,
        reservation_id=reservation.id,
        listing_id=reservation.listing_id,
        buyer_id=user.id,
        window_id=window.id,
    )
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Window already booked") from e
    return {"booked": True, "window_id": str(window.id)}


@router.post("/{reservation_id}/outcome", response_model=None)
async def mark_outcome(
    reservation_id: uuid.UUID,
    body: OutcomeIn,
    user: CurrentUser,
    session: SessionDep,
) -> dict[str, Any]:
    reservation = await _for_party(session, reservation_id, user)
    party = (
        OutcomeParty.buyer if user.id == reservation.buyer_id else OutcomeParty.seller
    )
    try:
        await svc.mark_outcome(reservation, party, body.result, deps=svc.default_deps())
    except (
        svc.OutcomeLockedError,
        svc.OutcomeWindowClosedError,
        svc.ReservationStateError,
    ) as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from e
    await session.commit()
    response = {"status": reservation.status, "outcome": reservation.outcome}

    other_id = (
        reservation.seller_id if party is OutcomeParty.buyer else reservation.buyer_id
    )
    other = await session.get(User, other_id)
    await _safe_sms(
        other.phone if other else None,
        f"Результат просмотра отмечен: {body.result.value}. Депозит возвращён.",
    )
    await notifications.push(
        session,
        user_id=other_id,
        notif_type="reservation_outcome_marked",
        payload={"reservation_id": str(reservation_id), "outcome": body.result.value},
    )
    return response


@router.post("/{reservation_id}/cancel", response_model=None)
async def cancel_reservation(
    reservation_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> dict[str, Any]:
    reservation = await _for_party(session, reservation_id, user)
    if user.id != reservation.buyer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    seller_id = reservation.seller_id

    now = datetime.now(UTC)
    was_active = reservation.status in _ACTIVE_FOR_DELAY
    is_early = (
        was_active
        and (now - reservation.created_at).total_seconds()
        < settings.EARLY_CANCEL_WINDOW_SECONDS
    )
    if was_active:
        since = now - timedelta(seconds=settings.REFUND_DELAY_WINDOW_SECONDS)
        cancel_count = await res_crud.count_buyer_cancels_in_window(
            session, user.id, since
        )
        delay = _refund_delay_seconds(cancel_count)
        if delay > 0:
            reservation.deposit_release_due_at = now + timedelta(seconds=delay)

    await _cancel(session, reservation, reason=CancelReason.buyer_cancelled)

    if is_early:
        await redis.set(
            _COOLDOWN_KEY.format(buyer_id=user.id),
            "1",
            ex=settings.EARLY_CANCEL_COOLDOWN_SECONDS,
        )

    response = {"status": reservation.status}
    seller = await session.get(User, seller_id)
    await _safe_sms(seller.phone if seller else None, "Покупатель отменил бронь.")
    await notifications.push(
        session,
        user_id=seller_id,
        notif_type="reservation_cancelled_by_buyer",
        payload={"reservation_id": str(reservation_id)},
    )
    return response


@router.post("/{reservation_id}/decline", response_model=None)
async def decline_reservation(
    reservation_id: uuid.UUID,
    body: DeclineIn,
    user: CurrentUser,
    session: SessionDep,
) -> dict[str, Any]:
    reservation = await _for_party(session, reservation_id, user)
    if user.id != reservation.seller_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN)
    buyer_id = reservation.buyer_id
    await _cancel(session, reservation, reason=CancelReason.seller_declined)
    response = {"status": reservation.status}
    logger.info(
        "reservation.declined_by_seller",
        extra={"reservation_id": str(reservation_id), "reason": body.reason},
    )
    buyer = await session.get(User, buyer_id)
    await _safe_sms(
        buyer.phone if buyer else None,
        f"Продавец отклонил бронь: {body.reason}. Депозит возвращён.",
    )
    await notifications.push(
        session,
        user_id=buyer_id,
        notif_type="reservation_declined_by_seller",
        payload={"reservation_id": str(reservation_id), "reason": body.reason},
    )
    return response


@router.delete("/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reservation(
    reservation_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> None:
    reservation = await _for_party(session, reservation_id, user)
    if reservation.status != ReservationStatus.cancelled:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only cancelled reservations can be deleted",
        )
    await session.delete(reservation)
    await session.commit()


async def _cancel(
    session: SessionDep, reservation: Reservation, *, reason: CancelReason
) -> None:
    listing = await listing_crud.get(session, reservation.listing_id)
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    booking = await viewings_crud.get_active_booking_for_reservation(
        session, reservation.id
    )
    if booking is not None:
        await viewings_crud.cancel_booking(booking)
    await svc.cancel(reservation, listing, reason=reason, deps=svc.default_deps())
    await session.commit()
