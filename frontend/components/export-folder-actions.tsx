"use client";

import { useEffect, useState } from "react";

import { getExportMeta } from "@/lib/api";
import { ExportMeta } from "@/lib/types";

function toFileUrl(path: string) {
  return `file:///${path.replace(/\\/g, "/")}`;
}

export function ExportFolderActions() {
  const [meta, setMeta] = useState<ExportMeta | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        setError(null);
        setMeta(await getExportMeta());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load export path.");
      }
    }

    void loadMeta();
  }, []);

  async function handleCopy() {
    if (!meta) {
      return;
    }

    try {
      await navigator.clipboard.writeText(meta.export_root);
      setMessage("Export path copied.");
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  function handleOpen() {
    if (!meta) {
      return;
    }
    window.open(toFileUrl(meta.export_root), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[#f7f0e4] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Local exports</p>
      <p className="mt-2 break-all text-sm text-[var(--text)]">
        {meta ? meta.export_root : "Loading export folder path..."}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleOpen}
          disabled={!meta}
          className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm disabled:opacity-60"
        >
          Open export folder
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!meta}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
        >
          Copy path
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
