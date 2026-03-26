import {
  DailyConversationCompleteResponse,
  DailyConversationMessageResponse,
  DailyConversationPlan,
  DailyConversationStartResponse,
  DailyLog,
  DailyLogSummary,
  DailySession,
  DailySessionSummary,
  ExportMeta,
  GeminiModel,
  LlmSettings,
  LlmSettingsPayload,
  LlmTestResponse,
  Topic,
  TopicPayload,
  TrackedItem,
  TrackedItemPayload,
} from "@/lib/types";

const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000";
export const API_BASE_URL = rawApiBase.endsWith("/") ? rawApiBase.slice(0, -1) : rawApiBase;

type ApiErrorPayload = {
  detail?: string | { msg?: string }[];
  errors?: { msg?: string }[];
  error_type?: string;
  status_code?: number;
};

function extractErrorMessage(payload: ApiErrorPayload, fallbackStatus: number) {
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors.map((error) => error.msg || "Validation error").join(", ");
  }
  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    return payload.detail.map((error) => error.msg || "Validation error").join(", ");
  }
  return `Request failed with status ${fallbackStatus}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(
      `Could not reach the Diary backend at ${API_BASE_URL}. Make sure the FastAPI server is running and local CORS is allowed. ${detail}`,
    );
  }

  if (!response.ok) {
    const rawDetail = await response.text();
    let parsedMessage: string | null = null;
    try {
      const parsed = JSON.parse(rawDetail) as ApiErrorPayload;
      parsedMessage = extractErrorMessage(parsed, response.status);
    } catch {
      parsedMessage = null;
    }
    throw new Error(parsedMessage || rawDetail || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listTrackedItems(activeOnly = false) {
  return request<TrackedItem[]>(`/tracked-items?active_only=${activeOnly}`);
}

export function createTrackedItem(payload: TrackedItemPayload) {
  return request<TrackedItem>("/tracked-items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTrackedItem(id: number, payload: Partial<TrackedItemPayload>) {
  return request<TrackedItem>(`/tracked-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTrackedItem(id: number) {
  return request<void>(`/tracked-items/${id}`, {
    method: "DELETE",
  });
}

export function listTopics(status?: string) {
  const suffix = status ? `?status=${status}` : "";
  return request<Topic[]>(`/topics${suffix}`);
}

export function createTopic(payload: TopicPayload) {
  return request<Topic>("/topics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createOnboardingTopics(focusAreas: string[]) {
  return request<Topic[]>("/topics/onboarding", {
    method: "POST",
    body: JSON.stringify({ focus_areas: focusAreas }),
  });
}

export function updateTopic(id: number, payload: Partial<TopicPayload>) {
  return request<Topic>(`/topics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function planDailyConversation(sessionDate?: string) {
  return request<DailyConversationPlan>("/daily-conversation/plan", {
    method: "POST",
    body: JSON.stringify(sessionDate ? { session_date: sessionDate } : {}),
  });
}

export function startDailyConversation(sessionDate?: string) {
  return request<DailyConversationStartResponse>("/daily-conversation/start", {
    method: "POST",
    body: JSON.stringify(sessionDate ? { session_date: sessionDate } : {}),
  });
}

export function sendDailyConversationMessage(sessionId: number, content: string) {
  return request<DailyConversationMessageResponse>("/daily-conversation/message", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      message: content,
    }),
  });
}

export function completeDailyConversation(sessionId: number) {
  return request<DailyConversationCompleteResponse>("/daily-conversation/complete", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function getDailySession(sessionDate: string) {
  return request<DailySession>(`/daily-sessions/${sessionDate}`);
}

export function listDailySessions(limit = 30) {
  return request<DailySessionSummary[]>(`/daily-sessions?limit=${limit}`);
}

export function getDailyLog(logDate: string) {
  return request<DailyLog>(`/daily-logs/${logDate}`);
}

export function listDailyLogs(limit = 30) {
  return request<DailyLogSummary[]>(`/daily-logs?limit=${limit}`);
}

export function getExportMeta() {
  return request<ExportMeta>("/exports/meta");
}

export function getLlmSettings() {
  return request<LlmSettings>("/settings/llm");
}

export function saveLlmSettings(payload: LlmSettingsPayload) {
  return request<LlmSettings>("/settings/llm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listGeminiModels() {
  return request<GeminiModel[]>("/settings/llm/models");
}

export function testLlmSettings(apiKey?: string | null, modelName?: string | null) {
  return request<LlmTestResponse>("/settings/llm/test", {
    method: "POST",
    body: JSON.stringify({
      api_key: apiKey ?? null,
      model_name: modelName ?? null,
    }),
  });
}
