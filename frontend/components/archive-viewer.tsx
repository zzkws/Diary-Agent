"use client";

import { useEffect, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import { getDailyLog, listDailyLogs } from "@/lib/api";
import { getLocalDateString } from "@/lib/date";
import { DailyLog, DailyLogSummary } from "@/lib/types";

export function ArchiveViewer() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [summaries, setSummaries] = useState<DailyLogSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummaries() {
    try {
      setSummaryLoading(true);
      setSummaries(await listDailyLogs());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load archive list.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleLoad(targetDate = selectedDate) {
    try {
      setLoading(true);
      setError(null);
      setSelectedDate(targetDate);
      setDailyLog(await getDailyLog(targetDate));
    } catch (loadError) {
      setDailyLog(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load daily log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummaries();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
      <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">Daily archive</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Open a saved day or browse recent records below.</p>
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
              <h3 className="text-lg font-semibold">Recent days</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Each card is one saved day.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadSummaries()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {summaryLoading ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                Loading recent days...
              </div>
            ) : null}
            {!summaryLoading && summaries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                No saved days yet. Complete a daily check-in to populate the archive.
              </div>
            ) : null}
            {summaries.map((summary) => (
              <button
                key={summary.id}
                type="button"
                onClick={() => void handleLoad(summary.log_date)}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 text-left transition hover:border-[var(--accent)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{summary.log_date}</span>
                  <span className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {summary.entry_count} items
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {summary.extra_note ? "Includes an extra note." : "Fixed items only."}
                </p>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        {!dailyLog ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] px-5 py-12 text-sm text-[var(--muted)]">
            No day loaded. Select a date or open one of the recent saved days.
          </div>
        ) : null}

        {dailyLog ? (
          <div className="grid gap-5">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Loaded day</p>
              <h2 className="mt-2 text-2xl font-semibold">{dailyLog.log_date}</h2>
              <p className="mt-2 break-all text-sm text-[var(--muted)]">
                Markdown file: {dailyLog.markdown_path ?? "Not available"}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Fixed items</h3>
              <div className="mt-4 grid gap-3">
                {dailyLog.entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-[var(--border)] px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">{entry.item_name}</span>
                      <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{entry.status}</span>
                    </div>
                    {entry.raw_answer ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">Raw answer: {entry.raw_answer}</p>
                    ) : null}
                    <p className="mt-2 text-sm leading-6">{entry.final_text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border)] bg-white p-5">
              <h3 className="text-lg font-semibold">Extra note</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{dailyLog.extra_note || "-"}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
