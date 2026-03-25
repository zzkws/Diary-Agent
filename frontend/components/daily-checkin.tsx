"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { answerCheckIn, completeCheckIn, startCheckIn } from "@/lib/api";
import { getLocalDateString } from "@/lib/date";
import { DailyLog, QuestionStep } from "@/lib/types";

export function DailyCheckInFlow() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<QuestionStep | null>(null);
  const [answer, setAnswer] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [savedLog, setSavedLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const extraNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const progressPercent = useMemo(() => {
    if (savedLog) {
      return 100;
    }
    if (step) {
      return Math.round(((step.index - 1) / step.total) * 100);
    }
    if (isComplete) {
      return 100;
    }
    return 0;
  }, [isComplete, savedLog, step]);
  const finalTextPreview = step ? (answer.trim() === "" ? step.tracked_item.default_text_if_empty : answer.trim()) : "";

  useEffect(() => {
    if (step) {
      answerRef.current?.focus();
      return;
    }
    if (sessionId && isComplete) {
      extraNoteRef.current?.focus();
    }
  }, [isComplete, sessionId, step]);

  async function handleStart() {
    try {
      setLoading(true);
      setError(null);
      setSavedLog(null);
      const response = await startCheckIn(selectedDate);
      setSessionId(response.session_id);
      setStep(response.current_step);
      setIsComplete(response.is_complete);
      setAnswer("");
      setExtraNote("");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Unable to start check-in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer() {
    if (!sessionId || !step) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await answerCheckIn(sessionId, step.tracked_item.id, answer);
      setStep(response.current_step);
      setIsComplete(response.is_complete);
      setAnswer("");
    } catch (answerError) {
      setError(answerError instanceof Error ? answerError.message : "Unable to save answer.");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!sessionId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await completeCheckIn(sessionId, extraNote);
      setSavedLog(response);
      setSessionId(null);
      setStep(null);
      setIsComplete(false);
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "Unable to complete check-in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-semibold">Start check-in</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Diary will ask each active tracked item in sequence and store everything locally.
        </p>
        <label className="mt-5 grid gap-2">
          <span className="text-sm font-medium">Log date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={loading}
          className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading && !sessionId ? "Starting..." : "Start check-in"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        {!sessionId && !savedLog ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-sm text-[var(--muted)]">
            No active check-in yet.
          </div>
        ) : null}

        <div className="mb-6 overflow-hidden rounded-full bg-[#ead9c5]">
          <div
            className="h-2 rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {sessionId && step ? (
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Question {step.index} of {step.total}
            </p>
            <h2 className="mt-3 text-2xl font-semibold">{step.tracked_item.name}</h2>
            <p className="mt-3 text-base leading-7">{step.tracked_item.question}</p>
            <textarea
              ref={answerRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleAnswer();
                }
              }}
              className="mt-5 min-h-40 w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-4"
              placeholder="Leave blank to use the default text."
            />
            <p className="mt-3 text-sm text-[var(--muted)]">
              Default if blank: {step.tracked_item.default_text_if_empty}
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[#f7f0e4] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Will be saved as</p>
              <p className="mt-2 text-sm">{finalTextPreview}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleAnswer()}
              disabled={loading}
              className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save and continue"}
            </button>
          </div>
        ) : null}

        {sessionId && isComplete && !step ? (
          <div>
            <h2 className="text-2xl font-semibold">Anything else about today?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This note is optional and is stored beneath the fixed items.
            </p>
            <textarea
              ref={extraNoteRef}
              value={extraNote}
              onChange={(event) => setExtraNote(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleComplete();
                }
              }}
              className="mt-5 min-h-40 w-full rounded-3xl border border-[var(--border)] bg-white px-4 py-4"
              placeholder="Optional extra note"
            />
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={loading}
              className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Finalizing..." : "Complete and save"}
            </button>
          </div>
        ) : null}

        {savedLog ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <h2 className="text-xl font-semibold">Saved for {savedLog.log_date}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Markdown and CSV exports have been updated locally.</p>
            <div className="mt-5 grid gap-3">
              {savedLog.entries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border)] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">{entry.item_name}</span>
                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{entry.status}</span>
                  </div>
                  <p className="mt-2 text-sm">{entry.final_text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
