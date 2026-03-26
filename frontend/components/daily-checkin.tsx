"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import {
  API_BASE_URL,
  completeDailyConversation,
  createOnboardingTopics,
  listTopics,
  sendDailyConversationMessage,
  startDailyConversation,
} from "@/lib/api";
import { getLocalDateString } from "@/lib/date";
import {
  ConversationMessage,
  ConversationSessionStatus,
  DailyConversationCompleteResponse,
  Topic,
  TopicUpdate,
} from "@/lib/types";

type ChatState = {
  sessionId: number | null;
  sessionStatus: ConversationSessionStatus | null;
  transcript: ConversationMessage[];
  topicUpdates: TopicUpdate[];
  sessionDate: string;
};

const emptyChatState = (sessionDate: string): ChatState => ({
  sessionId: null,
  sessionStatus: null,
  transcript: [],
  topicUpdates: [],
  sessionDate,
});

export function DailyCheckInFlow() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [chatState, setChatState] = useState<ChatState>(emptyChatState(today));
  const [message, setMessage] = useState("");
  const [onboardingText, setOnboardingText] = useState("");
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<DailyConversationCompleteResponse | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  async function loadTopics() {
    try {
      setLoadingTopics(true);
      setError(null);
      setTopics(await listTopics());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load topics.");
    } finally {
      setLoadingTopics(false);
    }
  }

  useEffect(() => {
    void loadTopics();
  }, []);

  useEffect(() => {
    setChatState(emptyChatState(selectedDate));
    setCompletionResult(null);
    setMessage("");
  }, [selectedDate]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatState.transcript, sending, starting]);

  useEffect(() => {
    if (chatState.sessionId && chatState.sessionStatus === "active" && !sending) {
      messageRef.current?.focus();
    }
  }, [chatState.sessionId, chatState.sessionStatus, sending]);

  const isReadyToSave = chatState.sessionStatus === "complete" && chatState.sessionId !== null;
  const hasTopics = topics.length > 0;
  const canSend = !!chatState.sessionId && chatState.sessionStatus === "active" && message.trim().length > 0 && !sending;

  const topicSummary = useMemo(() => {
    if (chatState.topicUpdates.length === 0) {
      return "No topic updates captured yet.";
    }
    return `${chatState.topicUpdates.length} topic update${chatState.topicUpdates.length === 1 ? "" : "s"} saved in this session so far.`;
  }, [chatState.topicUpdates]);

  async function handleStartConversation() {
    try {
      setStarting(true);
      setError(null);
      setCompletionResult(null);
      const response = await startDailyConversation(selectedDate);
      setChatState({
        sessionId: response.session_id,
        sessionStatus: response.session_status,
        transcript: response.transcript,
        topicUpdates: response.topic_updates,
        sessionDate: response.session_date,
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start today's conversation.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!chatState.sessionId || !canSend) {
      return;
    }

    try {
      setSending(true);
      setError(null);
      const response = await sendDailyConversationMessage(chatState.sessionId, message.trim());
      setChatState((current) => ({
        ...current,
        sessionStatus: response.session_status,
        transcript: response.transcript,
        topicUpdates: response.topic_updates,
      }));
      setMessage("");
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : "Unable to send that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleCompleteConversation() {
    if (!chatState.sessionId) {
      return;
    }

    try {
      setCompleting(true);
      setError(null);
      const response = await completeDailyConversation(chatState.sessionId);
      setCompletionResult(response);
      await loadTopics();
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to save this conversation.");
    } finally {
      setCompleting(false);
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
      setOnboarding(true);
      setError(null);
      await createOnboardingTopics(focusAreas);
      setOnboardingText("");
      await loadTopics();
    } catch (onboardingError) {
      setError(onboardingError instanceof Error ? onboardingError.message : "Unable to create starter topics.");
    } finally {
      setOnboarding(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Today</p>
          <h2 className="mt-2 text-2xl font-semibold">Diary chat</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Start a conversation and let Diary decide what to ask next. The frontend only renders the transcript and
            sends your messages.
          </p>

          <label className="mt-5 grid gap-2">
            <span className="text-sm font-medium">Session date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
            />
          </label>

          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleStartConversation()}
              disabled={starting || loadingTopics || !hasTopics}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {starting ? "Starting..." : "Start today's chat"}
            </button>
            <p className="text-sm text-[var(--muted)]">
              {loadingTopics ? "Checking topics..." : `${topics.length} topic${topics.length === 1 ? "" : "s"} available.`}
            </p>
            <p className="text-xs text-[var(--muted)]">API base: {API_BASE_URL}</p>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        {!hasTopics ? (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="text-lg font-semibold">Create starter topics</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add a few ongoing areas from your life so Diary has something real to remember and revisit.
            </p>
            <textarea
              value={onboardingText}
              onChange={(event) => setOnboardingText(event.target.value)}
              className="mt-4 min-h-28 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              placeholder="Examples: guitar practice, family plans, job search, running, side project"
            />
            <button
              type="button"
              onClick={() => void handleOnboarding()}
              disabled={onboarding}
              className="mt-4 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {onboarding ? "Creating..." : "Create starter topics"}
            </button>
          </section>
        ) : null}

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-lg font-semibold">Session notes</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">{topicSummary}</p>
          <div className="mt-4 grid gap-3">
            {chatState.topicUpdates.slice(-4).map((update) => (
              <div key={update.id} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{update.topic_title_snapshot}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{update.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{update.final_text}</p>
              </div>
            ))}
          </div>
        </section>

        <ExportFolderActions />
      </aside>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-white">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Conversation</p>
                <h3 className="mt-1 text-xl font-semibold">{chatState.sessionDate}</h3>
              </div>
              <div className="text-sm text-[var(--muted)]">
                {chatState.sessionStatus === "complete"
                  ? "Ready to save"
                  : chatState.sessionId
                    ? "Session active"
                    : "No active session"}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            {chatState.transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-md rounded-3xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm leading-6 text-[var(--muted)]">
                  Start a chat to let Diary ask naturally about today. It will keep the transcript locally and save the
                  topic updates when you finish.
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {chatState.transcript.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}`}
                    className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                      entry.role === "user"
                        ? "ml-auto bg-[var(--accent)] text-white"
                        : entry.role === "assistant"
                          ? "border border-[var(--border)] bg-[#f7f0e4] text-[var(--foreground)]"
                          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    }`}
                  >
                    <p
                      className={`text-[11px] uppercase tracking-[0.14em] ${
                        entry.role === "user" ? "text-white/80" : "text-[var(--muted)]"
                      }`}
                    >
                      {entry.role}
                      {entry.topic_title ? ` / ${entry.topic_title}` : ""}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
                {sending ? (
                  <div className="max-w-[88%] rounded-3xl border border-[var(--border)] bg-[#f7f0e4] px-4 py-3 text-sm text-[var(--muted)]">
                    Diary is thinking...
                  </div>
                ) : null}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 sm:px-5">
            {completionResult ? (
              <div className="rounded-3xl border border-[var(--border)] bg-white px-4 py-4">
                <h4 className="text-lg font-semibold">Saved locally</h4>
                <p className="mt-2 text-sm text-[var(--muted)]">Markdown: {completionResult.markdown_path ?? "-"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">CSV: {completionResult.csv_path}</p>
              </div>
            ) : null}

            {!completionResult ? (
              <div className="grid gap-3">
                {isReadyToSave ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[var(--muted)]">
                      The conversation is complete. Save it to write SQLite, Markdown, CSV, and topic updates locally.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCompleteConversation()}
                      disabled={completing}
                      className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {completing ? "Saving..." : "Save session"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="grid gap-3">
                    <textarea
                      ref={messageRef}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      disabled={!chatState.sessionId || chatState.sessionStatus !== "active" || sending}
                      className="min-h-28 w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-4"
                      placeholder={
                        chatState.sessionId
                          ? "Write your message and press Enter to send"
                          : "Start today's chat to begin"
                      }
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-[var(--muted)]">Press Enter to send. Use Shift+Enter for a new line.</p>
                      <button
                        type="submit"
                        disabled={!canSend}
                        className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {sending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
