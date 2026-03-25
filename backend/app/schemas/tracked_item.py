from datetime import datetime

from pydantic import ConfigDict
from sqlmodel import SQLModel


class TrackedItemCreate(SQLModel):
    name: str
    question: str
    default_text_if_empty: str
    is_active: bool = True
    sort_order: int = 0


class TrackedItemUpdate(SQLModel):
    name: str | None = None
    question: str | None = None
    default_text_if_empty: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class TrackedItemRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    question: str
    default_text_if_empty: str
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
