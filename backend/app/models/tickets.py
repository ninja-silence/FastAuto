import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, func
from sqlmodel import Field, SQLModel


class TicketType(StrEnum):
    purchase_dispute = "purchase_dispute"
    listing_report = "listing_report"
    moderation_appeal = "moderation_appeal"
    support_inquiry = "support_inquiry"


class TicketStatus(StrEnum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class Ticket(SQLModel, table=True):
    __tablename__ = "tickets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    type: TicketType
    status: TicketStatus = Field(default=TicketStatus.open, index=True)
    creator_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    assignee_id: uuid.UUID | None = Field(
        default=None, foreign_key="users.id", ondelete="SET NULL", index=True
    )
    listing_id: uuid.UUID | None = Field(default=None, foreign_key="listings.id")
    reservation_id: uuid.UUID | None = Field(
        default=None, foreign_key="reservations.id"
    )
    title: str = Field(max_length=200)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
        sa_column_kwargs={"server_default": func.now()},
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )


class TicketMessage(SQLModel, table=True):
    __tablename__ = "ticket_messages"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ticket_id: uuid.UUID = Field(
        foreign_key="tickets.id", ondelete="CASCADE", index=True
    )
    sender_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    body: str
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
        sa_column_kwargs={"server_default": func.now()},
    )
