from datetime import date, datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DailyLogBase(SQLModel):
    log_date: date = Field(index=True, unique=True)
    extra_note: str | None = Field(default=None, max_length=5000)
    markdown_path: str | None = Field(default=None, max_length=500)


class DailyLog(DailyLogBase, table=True):
    __tablename__ = "daily_logs"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
