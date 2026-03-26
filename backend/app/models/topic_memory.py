from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TopicMemoryBase(SQLModel):
    topic_id: int = Field(foreign_key="topics.id", index=True)
    daily_session_id: int | None = Field(default=None, foreign_key="daily_sessions.id", index=True)
    memory_text: str = Field(min_length=1, max_length=5000)


class TopicMemory(TopicMemoryBase, table=True):
    __tablename__ = "topic_memories"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
