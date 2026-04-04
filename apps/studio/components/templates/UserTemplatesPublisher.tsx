"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, Database } from "lucide-react";
import {
  listUserTemplates,
  createUserTemplate,
  publishTemplateVersion,
  getErrorMessage,
  type UserTemplateRow,
} from "@/lib/api";

const DEFAULT_PACKAGE = `{
  "schema_version": "1",
  "name": "My template",
  "description": "Describe this template",
  "category": "token",
  "chain_compatibility": ["base-sepolia"],
  "files": [
    {
      "path": "contracts/Token.sol",
      "content": "// SPDX-License-Identifier: MIT\\npragma solidity ^0.8.24;\\ncontract Token {}"
    }
  ],
  "contract_code": null,
  "frontend_scaffold": {},
  "tests": {},
  "metadata": {},
  "version": 1,
  "createdAt": "",
  "updatedAt": ""
}`;

export function UserTemplatesPublisher() {
  const [rows, setRows] = useState<UserTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createName, setCreateName] = useState("New project template");
  const [createDesc, setCreateDesc] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(DEFAULT_PACKAGE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserTemplates();
      setRows(res.templates ?? []);
      setSelectedId((prev) => {
        if (prev) return prev;
        return res.templates?.[0]?.id ?? null;
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "Could not load your templates"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    setBusy(true);
    try {
      const r = await createUserTemplate({
        name: createName.trim() || "Untitled",
        description: createDesc.trim(),
      });
      toast.success("Template created (draft)");
      setSelectedId(r.id);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Create failed"));
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async () => {
    if (!selectedId) {
      toast.error("Select or create a template first");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      toast.error("Invalid JSON");
      return;
    }
    setBusy(true);
    try {
      const out = await publishTemplateVersion(selectedId, parsed);
      toast.success(`Pinned: ${out.cid.slice(0, 12)}…`);
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Publish failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel rounded-xl border border-[var(--color-border-subtle)] p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
        <Database className="w-4 h-4 text-[var(--color-primary)]" />
        My templates (IPFS index)
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Database holds metadata and CID pointers. Content is pinned via the
        storage service; Pinata webhooks reconcile pin status when configured.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              New logical template
            </label>
            <input
              className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="Description"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onCreate()}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
            >
              Create draft
            </button>

            <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider pt-2">
              Your templates
            </label>
            <select
              className="w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              <option value="">Select…</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {(r.name || r.id).slice(0, 48)}
                </option>
              ))}
            </select>
            <ul className="text-[11px] text-[var(--color-text-tertiary)] space-y-1 max-h-32 overflow-y-auto">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)]/50 pb-1"
                >
                  <span className="truncate">{r.name ?? r.id}</span>
                  <span className="shrink-0 text-[10px] uppercase">
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Canonical package JSON
            </label>
            <textarea
              className="w-full min-h-[220px] rounded-lg border border-[var(--color-border-subtle)] bg-[#0d1117] px-3 py-2 text-[11px] font-mono text-[var(--color-text-secondary)]"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
            />
            <button
              type="button"
              disabled={busy || !selectedId}
              onClick={() => void onPublish()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              Upload & pin (new version)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
