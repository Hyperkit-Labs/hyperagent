"use client";

import type { Workflow } from "@/lib/types";

const LABELS: Record<string, string> = {
  draft: "Draft",
  validated: "Validated",
  production_ready: "Production-ready",
  blocked: "Blocked",
};

const STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  validated: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  production_ready: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  blocked: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function ArtifactMaturityBadge({ workflow }: { workflow: Workflow }) {
  const m = workflow.artifact_maturity;
  if (!m) return null;
  const label = LABELS[m] ?? m;
  const cls = STYLES[m] ?? STYLES.draft;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${cls}`}
      title="Artifact maturity from pipeline gates (draft → validated → production-ready). Not a legal audit."
    >
      {label}
    </span>
  );
}
