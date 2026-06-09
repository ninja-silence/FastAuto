from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.ai import AiMessageRole


class AiChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = None


class AiMessagePublic(BaseModel):
    id: uuid.UUID
    role: AiMessageRole
    content: str
    created_at: datetime
    listing_ids: list[str] = []

    model_config = {"from_attributes": True}


class AiConversationPublic(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime
    last_message_at: datetime

    model_config = {"from_attributes": True}


class AiConversationsPublic(BaseModel):
    data: list[AiConversationPublic]
    count: int


class AiConversationDetail(AiConversationPublic):
    messages: list[AiMessagePublic] = []


class AiToolCallPublic(BaseModel):
    id: uuid.UUID
    tool_name: str
    arguments: str
    result: str | None
    error: str | None
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
