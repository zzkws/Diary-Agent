from datetime import date, datetime

from sqlmodel import SQLModel

from ..models.item_entry import EntryStatus
from .tracked_item import TrackedItemRead


class DailyCheckInStartRequest(SQLModel):
    log_date: date | None = None


class QuestionStep(SQLModel):
    index: int
    total: int
    tracked_item: TrackedItemRead


class DailyCheckInStartResponse(SQLModel):
    session_id: str
    log_date: date
    total_items: int
    current_step: QuestionStep | None
    is_complete: bool


class DailyCheckInAnswerRequest(SQLModel):
    session_id: str
    tracked_item_id: int
    answer: str | None = None
    skipped: bool = False


class DailyCheckInAnswerResponse(SQLModel):
    accepted_entry_status: EntryStatus
    current_step: QuestionStep | None
    is_complete: bool


class DailyCheckInCompleteRequest(SQLModel):
    session_id: str
    extra_note: str | None = None


class SavedEntryRead(SQLModel):
    id: int
    tracked_item_id: int
    item_name: str
    raw_answer: str | None
    final_text: str
    status: EntryStatus
    created_at: datetime


class DailyLogRead(SQLModel):
    id: int
    log_date: date
    extra_note: str | None
    markdown_path: str | None
    created_at: datetime
    entries: list[SavedEntryRead]


class DailyLogSummary(SQLModel):
    id: int
    log_date: date
    extra_note: str | None
    markdown_path: str | None
    created_at: datetime
    entry_count: int


class ExportMetaRead(SQLModel):
    export_root: str
    markdown_root: str
    csv_path: str
