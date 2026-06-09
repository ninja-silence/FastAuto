from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col, func, select

from app.core.config import settings
from app.models.ai import AiConversation, AiMessage, AiMessageRole, AiToolCall


async def load_or_create_conversation(
    session: AsyncSession,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID | None,
    first_message: str,
) -> AiConversation:
    if conversation_id:
        result = await session.execute(
            select(AiConversation).where(
                AiConversation.id == conversation_id,
                AiConversation.user_id == user_id,
            )
        )
        conv = result.scalars().first()
        if conv:
            return conv

    title = first_message[:60] + ("..." if len(first_message) > 60 else "")
    conv = AiConversation(user_id=user_id, title=title)
    session.add(conv)
    await session.flush()
    return conv


async def load_history(
    session: AsyncSession, conversation_id: uuid.UUID
) -> list[dict[str, str]]:
    result = await session.execute(
        select(AiMessage)
        .where(AiMessage.conversation_id == conversation_id)
        .where(AiMessage.role != AiMessageRole.tool)
        .order_by(col(AiMessage.created_at).desc())
        .limit(settings.AI_MAX_HISTORY_MESSAGES)
    )
    messages = result.scalars().all()
    return [{"role": msg.role, "content": msg.content} for msg in reversed(messages)]


async def save_message(
    session: AsyncSession,
    conversation_id: uuid.UUID,
    role: AiMessageRole,
    content: str,
    model_name: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
) -> AiMessage:
    msg = AiMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )
    session.add(msg)
    await session.flush()
    return msg


async def save_tool_call(
    session: AsyncSession,
    message_id: uuid.UUID,
    tool_name: str,
    arguments: dict[str, Any],
    result: str | None,
    error: str | None,
    duration_ms: int | None,
) -> None:
    tc = AiToolCall(
        message_id=message_id,
        tool_name=tool_name,
        arguments=json.dumps(arguments, ensure_ascii=False),
        result=result,
        error=error,
        duration_ms=duration_ms,
    )
    session.add(tc)
    await session.flush()


async def touch_conversation(session: AsyncSession, conv: AiConversation) -> None:
    conv.last_message_at = datetime.now(UTC)
    session.add(conv)


async def get_user_conversations(
    session: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int | None = None,
) -> tuple[list[AiConversation], int]:
    if limit is None:
        limit = settings.PAGINATION_DEFAULT_LIMIT

    count_result = await session.execute(
        select(func.count())
        .select_from(AiConversation)
        .where(AiConversation.user_id == user_id)
    )
    count = count_result.scalar_one()
    result = await session.execute(
        select(AiConversation)
        .where(AiConversation.user_id == user_id)
        .order_by(col(AiConversation.last_message_at).desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), count


async def get_conversation_messages(
    session: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> tuple[AiConversation, list[AiMessage]] | None:
    result = await session.execute(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user_id,
        )
    )
    conv = result.scalars().first()
    if not conv:
        return None
    msgs_result = await session.execute(
        select(AiMessage)
        .where(AiMessage.conversation_id == conversation_id)
        .order_by(col(AiMessage.created_at).asc())
    )
    return conv, list(msgs_result.scalars().all())


async def get_listing_ids_for_messages(
    session: AsyncSession,
    message_ids: list[uuid.UUID],
) -> dict[str, list[str]]:
    """Returns {str(message_id): [listing_id, ...]} extracted from stored tool call results."""
    if not message_ids:
        return {}
    result = await session.execute(
        select(AiToolCall).where(
            col(AiToolCall.message_id).in_(message_ids),
            AiToolCall.tool_name == "search_listings",
        )
    )
    out: dict[str, list[str]] = {}
    for tc in result.scalars().all():
        if not tc.result:
            continue
        try:
            data = json.loads(tc.result)
            ids = [
                item["id"]
                for item in data.get("listings", [])
                if isinstance(item, dict) and "id" in item
            ]
            if ids:
                out.setdefault(str(tc.message_id), []).extend(ids)
        except (json.JSONDecodeError, TypeError):
            pass
    return out


async def delete_conversation(
    session: AsyncSession,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    result = await session.execute(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user_id,
        )
    )
    conv = result.scalars().first()
    if not conv:
        return False
    await session.delete(conv)
    await session.flush()
    return True
