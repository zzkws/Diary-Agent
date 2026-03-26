from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AgentSettingBase(SQLModel):
    provider: str = Field(default="gemini", max_length=40)
    api_key: str | None = Field(default=None, max_length=500)
    model_name: str | None = Field(default=None, max_length=120)
    system_prompt: str | None = Field(default=None, max_length=4000)


class AgentSetting(AgentSettingBase, table=True):
    __tablename__ = "agent_settings"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=utc_now, nullable=False)
