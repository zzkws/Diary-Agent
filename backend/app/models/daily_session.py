from datetime import date, datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DailySessionStatus(str, Enum):
    in_progress = "in_progress"
    completed = "completed"


class DailySessionBase(SQLModel):
    session_date: date = Field(index=True, unique=True)
    status: DailySessionStatus = Field(default=DailySessionStatus.in_progress, index=True)
    extra_note: str | None = Field(default=None, max_length=5000)
    markdown_path: str | None = Field(default=None, max_length=500)
    transcript_json: str = Field(default="[]")
    conversation_state_json: str = Field(default="{}")
    selected_topic_ids_json: str = Field(default="[]")
    archive_candidate_ids_json: str = Field(default="[]")


class DailySession(DailySessionBase, table=True):
    __tablename__ = "daily_sessions"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    completed_at: datetime | None = Field(default=None)
