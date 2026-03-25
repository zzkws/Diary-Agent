"use client";

import { FormEvent, useEffect, useState } from "react";

import { createTrackedItem, deleteTrackedItem, listTrackedItems, updateTrackedItem } from "@/lib/api";
import { TrackedItem, TrackedItemPayload } from "@/lib/types";

const emptyForm: TrackedItemPayload = {
  name: "",
  question: "",
  default_text_if_empty: "",
  is_active: true,
  sort_order: 0,
};

export function TrackedItemsManager() {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [form, setForm] = useState<TrackedItemPayload>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadItems() {
    try {
      setLoading(true);
      setError(null);
      setItems(await listTrackedItems());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tracked items.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await createTrackedItem({
        ...form,
        sort_order: Number(form.sort_order),
      });
      setForm(emptyForm);
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create tracked item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInlineUpdate(id: number, payload: Partial<TrackedItemPayload>) {
    try {
      setError(null);
      await updateTrackedItem(id, payload);
      await loadItems();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update tracked item.");
    }
  }

  async function handleDelete(id: number) {
    try {
      setError(null);
      await deleteTrackedItem(id);
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete tracked item.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <form
        onSubmit={handleCreate}
        className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(99,70,35,0.08)]"
      >
        <h2 className="text-xl font-semibold">Add tracked item</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Define the exact question Diary should ask every day.</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              placeholder="Mood"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Question</span>
            <textarea
              value={form.question}
              onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
              className="min-h-24 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              placeholder="How did your mood feel today?"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Default text if empty</span>
            <textarea
              value={form.default_text_if_empty}
              onChange={(event) =>
                setForm((current) => ({ ...current, default_text_if_empty: event.target.value }))
              }
              className="min-h-20 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              placeholder="No mood note recorded."
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium">Sort order</span>
            <input
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))
              }
              className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
            />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[#f7f0e4] px-4 py-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
            />
            <span className="text-sm font-medium">Ask this item during daily check-in</span>
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Create item"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </form>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Current items</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Items are asked in ascending sort order.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadItems()}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          {loading ? <p className="text-sm text-[var(--muted)]">Loading tracked items...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--muted)]">
              No tracked items yet.
            </p>
          ) : null}
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <div className="grid gap-3">
                <input
                  defaultValue={item.name}
                  onBlur={(event) => {
                    if (event.target.value !== item.name) {
                      void handleInlineUpdate(item.id, { name: event.target.value });
                    }
                  }}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 font-medium"
                />
                <textarea
                  defaultValue={item.question}
                  onBlur={(event) => {
                    if (event.target.value !== item.question) {
                      void handleInlineUpdate(item.id, { question: event.target.value });
                    }
                  }}
                  className="min-h-20 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
                <textarea
                  defaultValue={item.default_text_if_empty}
                  onBlur={(event) => {
                    if (event.target.value !== item.default_text_if_empty) {
                      void handleInlineUpdate(item.id, { default_text_if_empty: event.target.value });
                    }
                  }}
                  className="min-h-20 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span>Order</span>
                    <input
                      type="number"
                      defaultValue={item.sort_order}
                      onBlur={(event) => {
                        const nextValue = Number(event.target.value);
                        if (nextValue !== item.sort_order) {
                          void handleInlineUpdate(item.id, { sort_order: nextValue });
                        }
                      }}
                      className="w-24 rounded-xl border border-[var(--border)] px-3 py-2"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.is_active}
                      onChange={(event) =>
                        void handleInlineUpdate(item.id, { is_active: event.target.checked })
                      }
                    />
                    <span>Active</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="rounded-full border border-red-200 px-4 py-2 text-sm text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
