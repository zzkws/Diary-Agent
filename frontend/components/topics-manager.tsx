"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import { createTopic, listTopics, updateTopic } from "@/lib/api";
import { Topic, TopicPayload, TopicStatus } from "@/lib/types";

const emptyForm: TopicPayload = {
  title: "",
  description: "",
  status: "active",
  importance_score: 0.6,
  cadence_hint: "weekly",
  default_text_if_empty: "",
};

const filters: Array<{ label: string; value: TopicStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Dormant", value: "dormant" },
  { label: "Archived", value: "archived" },
];

export function TopicsManager() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState<TopicPayload>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TopicStatus | "all">("all");

  async function loadTopics(filter = statusFilter) {
    try {
      setLoading(true);
      setError(null);
      setTopics(await listTopics(filter === "all" ? undefined : filter));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load topics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      active: topics.filter((topic) => topic.status === "active").length,
      dormant: topics.filter((topic) => topic.status === "dormant").length,
      archived: topics.filter((topic) => topic.status === "archived").length,
    }),
    [topics],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await createTopic({
        ...form,
        description: form.description || null,
        default_text_if_empty: form.default_text_if_empty || null,
      });
      setForm(emptyForm);
      await loadTopics();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create topic.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(topicId: number, payload: Partial<TopicPayload>) {
    try {
      setError(null);
      await updateTopic(topicId, payload);
      await loadTopics();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update topic.");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.15fr]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Active</p>
          <h2 className="mt-2 text-2xl font-semibold">{counts.active}</h2>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Dormant</p>
          <h2 className="mt-2 text-2xl font-semibold">{counts.dormant}</h2>
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Archived</p>
          <h2 className="mt-2 text-2xl font-semibold">{counts.archived}</h2>
        </div>
        <ExportFolderActions />
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-6 xl:self-start"
        >
          <h2 className="text-xl font-semibold">Create topic</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Topics represent hobbies, projects, life items, and ongoing threads Diary can revisit over time.
          </p>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                placeholder="Photography"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Description</span>
              <textarea
                value={form.description ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                placeholder="An ongoing topic Diary should remember."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as TopicStatus }))
                  }
                  className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                >
                  <option value="active">Active</option>
                  <option value="dormant">Dormant</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium">Cadence hint</span>
                <select
                  value={form.cadence_hint}
                  onChange={(event) => setForm((current) => ({ ...current, cadence_hint: event.target.value }))}
                  className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                >
                  <option value="daily">Daily</option>
                  <option value="every_few_days">Every few days</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="sporadic">Sporadic</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Importance score</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={form.importance_score}
                onChange={(event) =>
                  setForm((current) => ({ ...current, importance_score: Number(event.target.value) }))
                }
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Default text if empty</span>
              <textarea
                value={form.default_text_if_empty ?? ""}
                onChange={(event) =>
                  setForm((current) => ({ ...current, default_text_if_empty: event.target.value }))
                }
                className="min-h-20 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                placeholder="No update recorded for Photography today."
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {saving ? "Saving..." : "Create topic"}
          </button>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </form>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Topic manager</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Active topics are regularly considered, dormant topics can return, and archived topics stay out of rotation.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter.value);
                    void loadTopics(filter.value);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    statusFilter === filter.value
                      ? "border-[var(--accent)] bg-[#f7f0e4]"
                      : "border-[var(--border)] bg-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                Loading topics...
              </div>
            ) : null}
            {!loading && topics.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
                No topics yet. Create one or let Diary discover one from future conversations.
              </div>
            ) : null}
            {topics.map((topic) => (
              <article key={topic.id} className="rounded-3xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <input
                      defaultValue={topic.title}
                      onBlur={(event) => {
                        if (event.target.value !== topic.title) {
                          void handleUpdate(topic.id, { title: event.target.value });
                        }
                      }}
                      className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-lg font-medium"
                    />
                    <textarea
                      defaultValue={topic.description ?? ""}
                      onBlur={(event) => {
                        if (event.target.value !== (topic.description ?? "")) {
                          void handleUpdate(topic.id, { description: event.target.value || null });
                        }
                      }}
                      className="mt-3 min-h-20 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid gap-3 sm:w-52">
                    <select
                      value={topic.status}
                      onChange={(event) =>
                        void handleUpdate(topic.id, { status: event.target.value as TopicStatus })
                      }
                      className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="dormant">Dormant</option>
                      <option value="archived">Archived</option>
                    </select>
                    <select
                      value={topic.cadence_hint}
                      onChange={(event) => void handleUpdate(topic.id, { cadence_hint: event.target.value })}
                      className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="every_few_days">Every few days</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="sporadic">Sporadic</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      defaultValue={topic.importance_score}
                      onBlur={(event) => {
                        const nextValue = Number(event.target.value);
                        if (nextValue !== topic.importance_score) {
                          void handleUpdate(topic.id, { importance_score: nextValue });
                        }
                      }}
                      className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                  <p>Recency score: {topic.recency_score.toFixed(2)}</p>
                  <p>Last asked: {topic.last_asked_at ? new Date(topic.last_asked_at).toLocaleString() : "-"}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
