from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TopicStatus(str, Enum):
    active = "active"
    dormant = "dormant"
    archived = "archived"


class TopicBase(SQLModel):
    title: str = Field(index=True, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    status: TopicStatus = Field(default=TopicStatus.active, index=True)
    importance_score: float = Field(default=0.6, ge=0.0, le=1.0)
    recency_score: float = Field(default=0.6, ge=0.0, le=1.0)
    cadence_hint: str = Field(default="weekly", max_length=40)
    source_question: str | None = Field(default=None, max_length=500)
    default_text_if_empty: str | None = Field(default=None, max_length=1000)
    source_tracked_item_id: int | None = Field(default=None, foreign_key="tracked_items.id", index=True)
    last_asked_at: datetime | None = Field(default=None, index=True)
    last_updated_at: datetime | None = Field(default=None, index=True)


class Topic(TopicBase, table=True):
    __tablename__ = "topics"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
