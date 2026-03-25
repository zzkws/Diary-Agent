from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TrackedItemBase(SQLModel):
    name: str = Field(index=True, min_length=1, max_length=120)
    question: str = Field(min_length=1, max_length=500)
    default_text_if_empty: str = Field(min_length=1, max_length=1000)
    is_active: bool = True
    sort_order: int = Field(default=0, index=True)


class TrackedItem(TrackedItemBase, table=True):
    __tablename__ = "tracked_items"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
