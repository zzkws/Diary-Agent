"use client";

import { useEffect, useMemo, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import { getDailySession, listDailySessions, listTopics } from "@/lib/api";
import { getLocalDateString } from "@/lib/date";
import { DailySession, DailySessionSummary, Topic } from "@/lib/types";

export function ArchiveViewer() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [summaries, setSummaries] = useState<DailySessionSummary[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [session, setSession] = useState<DailySession | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadArchiveSummary() {
    try {
      setSummaryLoading(true);
      setError(null);
      const [sessionSummaries, topicList] = await Promise.all([listDailySessions(), listTopics()]);
      setSummaries(sessionSummaries);
      setTopics(topicList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load archive.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleLoad(targetDate = selectedDate) {
    try {
      setLoading(true);
      setError(null);
      setSelectedDate(targetDate);
      setSession(await getDailySession(targetDate));
    } catch (loadError) {
      setSession(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load that conversation session.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArchiveSummary();
  }, []);

  const topicMap = useMemo(
    () => new Map<number, Topic>(topics.map((topic) => [topic.id, topic])),
    [topics],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
      <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">Conversation archive</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Open a saved day to review selected topics, question-and-answer turns, and extracted updates.
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
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={loading}
            className="mt-5 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Loading..." : "Open selected day"}
          </button>
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <ExportFolderActions />

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Recent sessions</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">One session per saved day.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadArchiveSummary()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {summaryLoading ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                Loading recent sessions...
              </div>
            ) : null}
            {!summaryLoading && summaries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                No saved conversation sessions yet.
              </div>
            ) : null}
            {summaries.map((summary) => (
              <button
                key={summary.id}
                type="button"
                onClick={() => void handleLoad(summary.session_date)}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-left transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{summary.session_date}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{summary.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {summary.selected_topic_ids.length} planned topic{summary.selected_topic_ids.length === 1 ? "" : "s"}
                </p>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        {!session ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] px-5 py-12 text-sm text-[var(--muted)]">
            No conversation session loaded yet.
          </div>
        ) : null}

        {session ? (
          <div className="grid gap-5">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Saved day</p>
              <h2 className="mt-2 text-2xl font-semibold">{session.session_date}</h2>
              <p className="mt-2 break-all text-sm text-[var(--muted)]">
                Markdown file: {session.markdown_path ?? "Not available"}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Selected topics</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {session.selected_topic_ids.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No planned topics were stored for this day.</p>
                ) : (
                  session.selected_topic_ids.map((topicId) => (
                    <span key={topicId} className="rounded-full border border-[var(--border)] px-3 py-2 text-sm">
                      {topicMap.get(topicId)?.title ?? `Topic ${topicId}`}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Extracted topic updates</h3>
              <div className="mt-4 grid gap-3">
                {session.updates.map((update) => (
                  <div key={update.id} className="rounded-2xl border border-[var(--border)] px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">{update.topic_title_snapshot}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{update.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">Question: {update.question_text}</p>
                    {update.raw_answer ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">Answer: {update.raw_answer}</p>
                    ) : null}
                    {update.follow_up_question ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">Follow-up: {update.follow_up_question}</p>
                    ) : null}
                    {update.follow_up_answer ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">Follow-up answer: {update.follow_up_answer}</p>
                    ) : null}
                    <p className="mt-2 text-sm">Saved update: {update.final_text}</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">Extracted update: {update.update_summary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Transcript</h3>
              <div className="mt-4 grid gap-3">
                {session.transcript.map((entry, index) => (
                  <div key={`${entry.role}-${index}`} className="rounded-2xl border border-[var(--border)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                      {entry.role} {entry.topic_title ? `• ${entry.topic_title}` : ""}
                    </p>
                    <p className="mt-2 text-sm leading-6">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Extra note</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{session.extra_note || "-"}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
