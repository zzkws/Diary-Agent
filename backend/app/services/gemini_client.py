from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from ..models.agent_setting import AgentSetting

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiClientError(Exception):
    pass


def _request_json(url: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise GeminiClientError(body or f"Gemini request failed with status {exc.code}") from exc
    except URLError as exc:
        raise GeminiClientError(str(exc.reason)) from exc


def list_models(api_key: str) -> list[dict[str, Any]]:
    url = f"{GEMINI_BASE_URL}/models?key={quote(api_key)}"
    payload = _request_json(url)
    return payload.get("models", [])


def generate_content(api_key: str, model_name: str, contents: list[dict[str, Any]], system_instruction: str | None = None) -> dict[str, Any]:
    normalized_model = model_name if model_name.startswith("models/") else f"models/{model_name}"
    url = f"{GEMINI_BASE_URL}/{normalized_model}:generateContent?key={quote(api_key)}"
    payload: dict[str, Any] = {"contents": contents}
    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}],
        }
    return _request_json(url, method="POST", payload=payload)


def extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                return text
    return ""


def test_connection(api_key: str, model_name: str) -> str:
    payload = generate_content(
        api_key,
        model_name,
        contents=[{"role": "user", "parts": [{"text": "Reply with exactly: ok"}]}],
    )
    text = extract_text(payload).strip()
    if not text:
        raise GeminiClientError("Gemini returned no text.")
    return text


def has_valid_llm_settings(setting: AgentSetting | None) -> bool:
    return bool(setting and setting.api_key and setting.model_name and setting.provider == "gemini")
