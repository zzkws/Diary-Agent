"use client";

import { useEffect, useState } from "react";

import { ExportFolderActions } from "@/components/export-folder-actions";
import { getLlmSettings, listGeminiModels, saveLlmSettings, testLlmSettings } from "@/lib/api";
import { GeminiModel, LlmSettingsPayload } from "@/lib/types";

const emptySettings: LlmSettingsPayload = {
  provider: "gemini",
  api_key: "",
  model_name: "",
  system_prompt: "You are a calm local-first diary agent. Ask about topics warmly, concretely, and without coaching or judgment.",
};

export function SettingsManager() {
  const [form, setForm] = useState<LlmSettingsPayload>(emptySettings);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError(null);
        const settings = await getLlmSettings();
        setForm({
          provider: settings.provider,
          api_key: settings.api_key ?? "",
          model_name: settings.model_name ?? "",
          system_prompt: settings.system_prompt ?? emptySettings.system_prompt,
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await saveLlmSettings({
        provider: form.provider,
        api_key: form.api_key || null,
        model_name: form.model_name || null,
        system_prompt: form.system_prompt || null,
      });
      setMessage("Settings saved locally.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchModels() {
    try {
      setFetchingModels(true);
      setError(null);
      setMessage(null);
      const nextModels = await listGeminiModels();
      setModels(nextModels);
      if (!form.model_name && nextModels[0]?.name) {
        setForm((current) => ({ ...current, model_name: nextModels[0].name }));
      }
      setMessage(`Loaded ${nextModels.length} Gemini models.`);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch Gemini models.");
    } finally {
      setFetchingModels(false);
    }
  }

  async function handleTest() {
    try {
      setTesting(true);
      setError(null);
      setMessage(null);
      const response = await testLlmSettings(form.api_key || null, form.model_name || null);
      setMessage(`Connection ok: ${response.message}`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Unable to test Gemini connection.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-xl font-semibold">LLM settings</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Configure Gemini locally so Diary can fetch models and use a conversational question style.
        </p>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
            Loading settings...
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Provider</span>
              <input value={form.provider} disabled className="rounded-2xl border border-[var(--border)] bg-[#f7f0e4] px-4 py-3" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Gemini API key</span>
              <input
                type="password"
                value={form.api_key ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
                placeholder="Paste your Gemini API key"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleFetchModels()}
                disabled={fetchingModels}
                className="rounded-full border border-[var(--border)] px-4 py-3 text-sm"
              >
                {fetchingModels ? "Fetching models..." : "Fetch Gemini models"}
              </button>
              <button
                type="button"
                onClick={() => void handleTest()}
                disabled={testing}
                className="rounded-full border border-[var(--border)] px-4 py-3 text-sm"
              >
                {testing ? "Testing..." : "Test connection"}
              </button>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Model</span>
              <select
                value={form.model_name ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, model_name: event.target.value }))}
                className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              >
                <option value="">Select a Gemini model</option>
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.display_name || model.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Optional system prompt</span>
              <textarea
                value={form.system_prompt ?? ""}
                onChange={(event) => setForm((current) => ({ ...current, system_prompt: event.target.value }))}
                className="min-h-32 rounded-2xl border border-[var(--border)] bg-white px-4 py-3"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              {saving ? "Saving..." : "Save settings locally"}
            </button>
          </div>
        )}

        {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </section>

      <div className="grid gap-4">
        <ExportFolderActions />
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="text-lg font-semibold">What this affects</h3>
          <div className="mt-4 grid gap-3 text-sm text-[var(--muted)]">
            <p>Diary can fetch Gemini models directly from your saved API key.</p>
            <p>When configured, Diary can phrase topic questions in a more natural conversational tone.</p>
            <p>The app still stores everything locally in SQLite, Markdown, and CSV.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
