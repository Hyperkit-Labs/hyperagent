"use client";

import Link from "next/link";
import { Loader2, Plus, Layers } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { PageTitle } from "@/components/layout/PageTitle";
import { useWorkflows } from "@/hooks/useWorkflows";

export default function AppsListPage() {
  const { workflows, loading, error } = useWorkflows({ filters: { limit: 50 } });

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <PageTitle
            title="Apps"
            subtitle="Apps are built from workflows. Create a workflow from Chat or the wizard, then view it here."
          />
          <Link
            href={ROUTES.APPS_NEW}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-[var(--color-text-primary)] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New app
          </Link>
        </div>
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4">
            <p className="text-sm text-[var(--color-semantic-error)]">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href={ROUTES.APPS_NEW}
              className="flex flex-col items-center justify-center min-h-[160px] rounded-xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-panel)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <Plus className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">New app</span>
              <span className="text-xs mt-1">Start from wizard</span>
            </Link>
            {workflows.map((w) => (
              <Link
                key={w.workflow_id}
                href={ROUTES.APPS_ID(w.workflow_id)}
                className="flex flex-col min-h-[160px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-panel)] p-4 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] flex items-center justify-center">
                    <Layers className="w-5 h-5 text-[var(--color-text-muted)]" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--color-bg-base)] text-[var(--color-text-tertiary)]">
                    {w.status ?? "—"}
                  </span>
                </div>
                <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                  {w.intent || w.workflow_id.slice(0, 12)}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 font-mono">{w.workflow_id.slice(0, 8)}...</p>
                <div className="mt-auto pt-4 flex gap-2">
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">View app</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!loading && !error && workflows.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-8 text-center">
            <Layers className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p className="text-sm text-[var(--color-text-tertiary)]">No apps yet.</p>
            <Link
              href={ROUTES.CHAT}
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-[var(--color-primary-light)]"
            >
              Create from idea in Chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
