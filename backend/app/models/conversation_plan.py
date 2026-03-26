from datetime import date, datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationPlanBase(SQLModel):
    plan_date: date = Field(index=True, unique=True)
    selected_topic_ids_json: str = Field(default="[]")
    archive_candidate_ids_json: str = Field(default="[]")
    plan_json: str = Field(default="[]")


class ConversationPlan(ConversationPlanBase, table=True):
    __tablename__ = "conversation_plans"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
