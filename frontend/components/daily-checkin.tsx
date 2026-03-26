"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import {
  completeDailyConversation,
  createOnboardingTopics,
  planDailyConversation,
  sendDailyConversationMessage,
  startDailyConversation,
} from "@/lib/api";
import { getLocalDateString } from "@/lib/date";
import {
  DailyConversationMessageResponse,
  DailyConversationPlan,
  DailyConversationStartResponse,
  DailySession,
} from "@/lib/types";

export function DailyCheckInFlow() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [plan, setPlan] = useState<DailyConversationPlan | null>(null);
  const [sessionState, setSessionState] = useState<DailyConversationStartResponse | DailyConversationMessageResponse | null>(null);
  const [savedSession, setSavedSession] = useState<DailySession | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [onboardingText, setOnboardingText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);

  async function loadPlan(targetDate = selectedDate) {
    try {
      setLoading(true);
      setError(null);
      const nextPlan = await planDailyConversation(targetDate);
      setPlan(nextPlan);
      setSessionState(null);
      setSessionId(null);
      setMessage("");
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to plan today's conversation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlan(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionState && sessionState.stage !== "ready_to_complete") {
      messageRef.current?.focus();
    }
  }, [sessionState]);

  const progressPercent = useMemo(() => {
    if (savedSession) {
      return 100;
    }
    if (!sessionState) {
      return 0;
    }
    if (sessionState.total_topics === 0) {
      return sessionState.stage === "ready_to_complete" ? 100 : 0;
    }
    const completed = sessionState.covered_topics;
    const base = Math.round((completed / sessionState.total_topics) * 100);
    return sessionState.stage === "ready_to_complete" ? 100 : base;
  }, [savedSession, sessionState]);

  async function handleStartConversation() {
    try {
      setLoading(true);
      setError(null);
      const response = await startDailyConversation(selectedDate);
      setSessionState(response);
      setSessionId(response.session_id);
      setSavedSession(null);
      setMessage("");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start the daily conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!sessionId || !sessionState) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await sendDailyConversationMessage(sessionId, message);
      setSessionState(response);
      setMessage("");
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : "Unable to save that reply.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteConversation() {
    if (!sessionId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await completeDailyConversation(sessionId);
      setSavedSession(response);
      setSessionState(null);
      setPlan(await planDailyConversation(selectedDate));
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete the conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOnboarding() {
    const focusAreas = onboardingText
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (focusAreas.length === 0) {
      setError("Add at least one topic or life area to get started.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await createOnboardingTopics(focusAreas);
      setOnboardingText("");
      await loadPlan(selectedDate);
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : "Unable to create onboarding topics.");
    } finally {
      setLoading(false);
    }
  }

  const transcript = savedSession?.transcript ?? sessionState?.transcript ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Daily conversation</p>
          <h2 className="mt-2 text-2xl font-semibold">{selectedDate}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Diary plans a small set of topics for today and asks about them one at a time.
          </p>

          <label className="mt-5 grid gap-2">
            <span className="text-sm font-medium">Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
            />
          </label>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setSavedSession(null);
                void loadPlan(selectedDate);
              }}
              disabled={loading}
              className="rounded-full border border-[var(--border)] px-4 py-3 text-sm"
            >
              Refresh plan
            </button>
            <button
              type="button"
              onClick={() => void handleStartConversation()}
              disabled={loading}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Working..." : "Start conversation"}
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-full bg-[#ead9c5]">
            <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Today's planned topics</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">A small rotating set, not every topic at once.</p>
            </div>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-sm">
              {plan?.topics.length ?? 0}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {!plan ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                Loading today's plan...
              </div>
            ) : null}
            {plan && plan.topics.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                No topics yet. Add a few focus areas below so Diary can start remembering them.
                <textarea
                  value={onboardingText}
                  onChange={(event) => setOnboardingText(event.target.value)}
                  className="mt-4 min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                  placeholder="Examples: guitar practice, job search, weekend runs, family plans"
                />
                <button
                  type="button"
                  onClick={() => void handleOnboarding()}
                  disabled={loading}
                  className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Create starter topics
                </button>
              </div>
            ) : null}
            {plan?.topics.map((topic) => (
              <div key={topic.topic_id} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{topic.title}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{topic.rationale}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{topic.question}</p>
              </div>
            ))}
          </div>
        </section>

        <ExportFolderActions />
      </aside>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        {transcript.length === 0 && !savedSession ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] px-5 py-12 text-sm text-[var(--muted)]">
            No conversation started yet. Review the planned topics and begin when you are ready.
          </div>
        ) : null}

        {transcript.length > 0 ? (
          <div className="grid gap-4">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
              <h3 className="text-lg font-semibold">Conversation</h3>
              <div className="mt-4 grid gap-3">
                {transcript.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                      entry.role === "assistant"
                        ? "border border-[var(--border)] bg-[#f7f0e4]"
                        : entry.role === "system"
                          ? "border border-[var(--border)] bg-[var(--surface)]"
                          : "border border-[var(--border)] bg-white"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {entry.role} {entry.topic_title ? `• ${entry.topic_title}` : ""}
                    </p>
                    <p className="mt-2">{entry.content || "-"}</p>
                  </div>
                ))}
              </div>
            </div>

            {sessionState && sessionState.stage !== "ready_to_complete" ? (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
                <h3 className="text-lg font-semibold">
                  {sessionState.stage === "extra_note" ? "Anything else from today?" : "Your reply"}
                </h3>
                <textarea
                  ref={messageRef}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      void handleSendMessage();
                    }
                  }}
                  className="mt-4 min-h-36 w-full rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
                  placeholder={
                    sessionState.stage === "extra_note"
                      ? "Anything else from today you want Diary to keep?"
                      : "Write your update here"
                  }
                />
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={loading}
                  className="mt-4 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  {loading ? "Saving..." : "Send reply"}
                </button>
              </div>
            ) : null}

            {sessionState?.stage === "ready_to_complete" ? (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
                <h3 className="text-lg font-semibold">Ready to save</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  The conversation is complete. Save it to update topics, transcript, Markdown, and CSV.
                </p>
                <button
                  type="button"
                  onClick={() => void handleCompleteConversation()}
                  disabled={loading}
                  className="mt-4 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  {loading ? "Saving..." : "Complete and save"}
                </button>
              </div>
            ) : null}

            {savedSession ? (
              <div className="rounded-3xl border border-[var(--border)] bg-white p-4">
                <h3 className="text-lg font-semibold">Saved updates</h3>
                <div className="mt-4 grid gap-3">
                  {savedSession.updates.map((update) => (
                    <div key={update.id} className="rounded-2xl border border-[var(--border)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{update.topic_title_snapshot}</span>
                        <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{update.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{update.question_text}</p>
                      <p className="mt-2 text-sm">{update.final_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
