"use client";

import { useState } from "react";

import { getDailyLog } from "@/lib/api";
import { DailyLog } from "@/lib/types";

export function ArchiveViewer() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoad() {
    try {
      setLoading(true);
      setError(null);
      setDailyLog(await getDailyLog(selectedDate));
    } catch (loadError) {
      setDailyLog(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load daily log.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-semibold">Open a day</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Look up a saved daily log by date.</p>
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
          className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Loading..." : "Load archive"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        {!dailyLog ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-sm text-[var(--muted)]">
            No log loaded.
          </div>
        ) : null}
        {dailyLog ? (
          <div>
            <h2 className="text-2xl font-semibold">{dailyLog.log_date}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Markdown file: {dailyLog.markdown_path ?? "Not available"}
            </p>
            <div className="mt-5 grid gap-3">
              {dailyLog.entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{entry.item_name}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{entry.status}</span>
                  </div>
                  {entry.raw_answer ? (
                    <p className="mt-2 text-sm text-[var(--muted)]">Raw answer: {entry.raw_answer}</p>
                  ) : null}
                  <p className="mt-2 text-sm">{entry.final_text}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white px-4 py-4">
              <p className="text-sm font-medium">Extra note</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{dailyLog.extra_note || "-"}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
