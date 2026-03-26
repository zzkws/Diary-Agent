from datetime import datetime

from pydantic import ConfigDict
from sqlmodel import SQLModel

from ..models.topic import TopicStatus


class TopicCreate(SQLModel):
    title: str
    description: str | None = None
    status: TopicStatus = TopicStatus.active
    importance_score: float = 0.6
    cadence_hint: str = "weekly"
    default_text_if_empty: str | None = None


class TopicUpdatePayload(SQLModel):
    title: str | None = None
    description: str | None = None
    status: TopicStatus | None = None
    importance_score: float | None = None
    cadence_hint: str | None = None
    default_text_if_empty: str | None = None


class TopicRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    status: TopicStatus
    importance_score: float
    recency_score: float
    cadence_hint: str
    source_question: str | None
    default_text_if_empty: str | None
    source_tracked_item_id: int | None
    last_asked_at: datetime | None
    last_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TopicOnboardingRequest(SQLModel):
    focus_areas: list[str]
