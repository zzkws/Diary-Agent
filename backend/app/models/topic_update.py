from datetime import datetime, timezone

from sqlmodel import Field, SQLModel

from .item_entry import EntryStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TopicUpdateBase(SQLModel):
    daily_session_id: int = Field(foreign_key="daily_sessions.id", index=True)
    topic_id: int = Field(foreign_key="topics.id", index=True)
    topic_title_snapshot: str = Field(min_length=1, max_length=160)
    question_text: str = Field(min_length=1, max_length=500)
    raw_answer: str | None = Field(default=None, max_length=5000)
    follow_up_question: str | None = Field(default=None, max_length=500)
    follow_up_answer: str | None = Field(default=None, max_length=5000)
    final_text: str = Field(min_length=1, max_length=5000)
    update_summary: str = Field(min_length=1, max_length=5000)
    status: EntryStatus = Field(default=EntryStatus.recorded, index=True)


class TopicUpdate(TopicUpdateBase, table=True):
    __tablename__ = "topic_updates"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
