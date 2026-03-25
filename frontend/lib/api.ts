import {
  DailyCheckInAnswerResponse,
  DailyCheckInStartResponse,
  DailyLog,
  TrackedItem,
  TrackedItemPayload,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
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

export function startCheckIn(logDate?: string) {
  return request<DailyCheckInStartResponse>("/daily-checkin/start", {
    method: "POST",
    body: JSON.stringify(logDate ? { log_date: logDate } : {}),
  });
}

export function answerCheckIn(sessionId: string, trackedItemId: number, answer: string) {
  return request<DailyCheckInAnswerResponse>("/daily-checkin/answer", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      tracked_item_id: trackedItemId,
      answer,
    }),
  });
}

export function completeCheckIn(sessionId: string, extraNote: string) {
  return request<DailyLog>("/daily-checkin/complete", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      extra_note: extraNote,
    }),
  });
}

export function getDailyLog(logDate: string) {
  return request<DailyLog>(`/daily-logs/${logDate}`);
}
