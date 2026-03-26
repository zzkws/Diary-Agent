from datetime import date, datetime
from typing import Literal

from sqlmodel import SQLModel

from ..models.daily_session import DailySessionStatus
from ..models.item_entry import EntryStatus
from ..models.topic import TopicStatus


class ConversationMessageRead(SQLModel):
    role: Literal["assistant", "user", "system"]
    content: str
    topic_id: int | None = None
    topic_title: str | None = None


class PlannedTopicRead(SQLModel):
    topic_id: int
    title: str
    status: TopicStatus
    question: str
    rationale: str
    importance_score: float
    recency_score: float


class DailyConversationPlanRequest(SQLModel):
    session_date: date | None = None


class DailyConversationPlanResponse(SQLModel):
    session_date: date
    topics: list[PlannedTopicRead]
    archive_candidates: list[int]


class DailyConversationStartRequest(SQLModel):
    session_date: date | None = None


class DailyConversationStartResponse(SQLModel):
    session_id: int
    session_date: date
    assistant_message: str
    session_status: Literal["active", "complete"]
    transcript: list[ConversationMessageRead]
    topic_updates: list["TopicUpdateRead"]


class DailyConversationMessageRequest(SQLModel):
    session_id: int
    message: str


class DailyConversationMessageResponse(SQLModel):
    session_id: int
    assistant_message: str
    session_status: Literal["active", "complete"]
    transcript: list[ConversationMessageRead]
    topic_updates: list["TopicUpdateRead"]


class DailyConversationCompleteRequest(SQLModel):
    session_id: int


class TopicUpdateRead(SQLModel):
    id: int
    topic_id: int
    topic_title_snapshot: str
    question_text: str
    raw_answer: str | None
    follow_up_question: str | None
    follow_up_answer: str | None
    final_text: str
    update_summary: str
    status: EntryStatus
    created_at: datetime


class DailySessionRead(SQLModel):
    id: int
    session_date: date
    status: DailySessionStatus
    extra_note: str | None
    markdown_path: str | None
    selected_topic_ids: list[int]
    archive_candidate_ids: list[int]
    transcript: list[ConversationMessageRead]
    updates: list[TopicUpdateRead]
    created_at: datetime
    completed_at: datetime | None


class DailySessionSummary(SQLModel):
    id: int
    session_date: date
    status: DailySessionStatus
    selected_topic_ids: list[int]
    extra_note: str | None
    markdown_path: str | None
    created_at: datetime


class DailyConversationCompleteResponse(SQLModel):
    ok: bool
    markdown_path: str | None
    csv_path: str
