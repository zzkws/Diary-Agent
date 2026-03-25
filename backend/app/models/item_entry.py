from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EntryStatus(str, Enum):
    recorded = "recorded"
    empty = "empty"
    skipped = "skipped"


class ItemEntryBase(SQLModel):
    daily_log_id: int = Field(foreign_key="daily_logs.id", index=True)
    tracked_item_id: int = Field(foreign_key="tracked_items.id", index=True)
    raw_answer: str | None = Field(default=None, max_length=5000)
    final_text: str = Field(min_length=1, max_length=5000)
    status: EntryStatus = Field(default=EntryStatus.recorded, index=True)


class ItemEntry(ItemEntryBase, table=True):
    __tablename__ = "item_entries"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
