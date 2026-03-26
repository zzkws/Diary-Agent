from datetime import datetime

from pydantic import ConfigDict
from sqlmodel import SQLModel


class AgentSettingRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str
    api_key: str | None
    model_name: str | None
    system_prompt: str | None
    updated_at: datetime | None = None


class AgentSettingSave(SQLModel):
    provider: str = "gemini"
    api_key: str | None = None
    model_name: str | None = None
    system_prompt: str | None = None


class AgentSettingTestRequest(SQLModel):
    api_key: str | None = None
    model_name: str | None = None


class AgentSettingTestResponse(SQLModel):
    ok: bool
    provider: str
    model_name: str | None
    message: str


class GeminiModelRead(SQLModel):
    name: str
    display_name: str | None = None
    description: str | None = None
    supported_generation_methods: list[str] = []
