from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.api.dependencies.auth import CurrentUser, RedisDep, SessionDep
from app.core.config import settings
from app.schemas.ai import (
    AiChatRequest,
    AiConversationDetail,
    AiConversationPublic,
    AiConversationsPublic,
    AiMessagePublic,
)
from app.services.ai.ai_history import (
    delete_conversation,
    get_conversation_messages,
    get_listing_ids_for_messages,
    get_user_conversations,
)
from app.services.ai.ai_rate_limiter import check_ai_rate_limit, get_remaining_requests
from app.services.ai.ai_service import stream_ai_response
from app.utils.pagination import PaginationDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", summary="Чат с AI-ассистентом", status_code=status.HTTP_200_OK)
async def ai_chat(
    request: Request,
    session: SessionDep,
    redis: RedisDep,
    current_user: CurrentUser,
    body: AiChatRequest,
) -> StreamingResponse:
    await check_ai_rate_limit(redis, str(current_user.id))

    logger.info(
        "AI chat: user=%s conversation=%s msg_len=%d",
        current_user.id,
        body.conversation_id,
        len(body.message),
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            async for chunk in stream_ai_response(
                user_message=body.message,
                user_id=current_user.id,
                session=session,
                conversation_id=body.conversation_id,
            ):
                if await request.is_disconnected():
                    logger.info("Client disconnected: user=%s", current_user.id)
                    break
                yield chunk
        except Exception as exc:
            logger.error(
                "Stream error user=%s: %s", current_user.id, exc, exc_info=True
            )
            yield f"data: {json.dumps({'type': 'error', 'message': 'Внутренняя ошибка сервера'})}\n\n"

    remaining = await get_remaining_requests(redis, str(current_user.id))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-RateLimit-Limit": str(settings.AI_MAX_REQUESTS_PER_MINUTE),
            "X-RateLimit-Remaining": str(remaining),
        },
    )


@router.get(
    "/conversations", response_model=AiConversationsPublic, summary="Мои диалоги с AI"
)
async def list_conversations(
    session: SessionDep,
    pagination: PaginationDep,
    current_user: CurrentUser,
) -> AiConversationsPublic:
    convs, count = await get_user_conversations(
        session,
        current_user.id,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    return AiConversationsPublic(
        data=[
            AiConversationPublic.model_validate(c, from_attributes=True) for c in convs
        ],
        count=count,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=AiConversationDetail,
    summary="Диалог",
)
async def get_conversation(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> AiConversationDetail:
    result = await get_conversation_messages(session, conversation_id, current_user.id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден"
        )

    conv, messages = result
    user_messages = [m for m in messages if m.role in ("user", "assistant")]

    assistant_ids = [m.id for m in user_messages if m.role == "assistant"]
    listing_ids_map = await get_listing_ids_for_messages(session, assistant_ids)

    return AiConversationDetail(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        last_message_at=conv.last_message_at,
        messages=[
            AiMessagePublic(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
                listing_ids=listing_ids_map.get(str(m.id), []),
            )
            for m in user_messages
        ],
    )


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить диалог",
)
async def delete_conversation_route(
    session: SessionDep,
    current_user: CurrentUser,
    conversation_id: uuid.UUID,
) -> None:
    deleted = await delete_conversation(session, conversation_id, current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Диалог не найден"
        )
    await session.commit()
