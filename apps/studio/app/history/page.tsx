"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { History, Search, Filter, Loader2, ChevronRight, ExternalLink, Bug } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { PageTitle } from "@/components/layout/PageTitle";
import { getWorkflows, getLogs, createQuickDemo, createDebugSandbox } from "@/lib/api";
import { StatusBadge, EmptyState } from "@/components/ui";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { hasAuditOrSimFailure } from "@/lib/types";

interface LogEntry {
  id?: string;
  timestamp: string;
  level: string;
  message: string;
  service?: string;
}

interface WorkflowItem {
  workflow_id: string;
  id?: string;
  intent?: string;
  prompt?: string;
  status?: string;
  network?: string;
  created_at?: string;
  stages?: Array<{ name?: string; stage?: string; status?: string }>;
}

type HistoryTab = "workflows" | "logs";

export default function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>("workflows");
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickDemoLoading, setQuickDemoLoading] = useState<string | null>(null);
  const [debugSandboxLoading, setDebugSandboxLoading] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    if (tab === "workflows") {
      getWorkflows({ limit: 100 })
        .then((r) => setWorkflows((r as { workflows?: WorkflowItem[] }).workflows || []))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load workflows"))
        .finally(() => setLoading(false));
    } else {
      getLogs({ page_size: 100 })
        .then((r) => setLogs(Array.isArray(r) ? r : (r as { logs?: LogEntry[] }).logs || []))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load logs"))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWorkflows = search.trim()
    ? workflows.filter(
        (w) =>
          (w.intent || w.prompt || "").toLowerCase().includes(search.toLowerCase()) ||
          (w.workflow_id || "").toLowerCase().includes(search.toLowerCase()) ||
          (w.status || "").toLowerCase().includes(search.toLowerCase())
      )
    : workflows;

  const filteredLogs = search.trim()
    ? logs.filter(
        (l) =>
          l.message.toLowerCase().includes(search.toLowerCase()) ||
          (l.service || "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6 animate-enter">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <PageTitle title="History" subtitle="Browse past workflows, runs, and log entries" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history, logs, or transactions..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-default)] focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
          {(["workflows", "logs"] as HistoryTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
              aria-selected={tab === t}
              role="tab"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && <ApiErrorBanner error={error} onRetry={fetchData} />}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : tab === "workflows" ? (
        filteredWorkflows.length === 0 ? (
          <EmptyState
            icon={<History className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title={search.trim() ? "No matching workflows" : "No workflow history"}
            description={search.trim() ? `No results for "${search}".` : "Create a workflow to see it here."}
            action={
              <Link href={ROUTES.HOME} className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg">
                Create workflow
              </Link>
            }
          />
        ) : (
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--color-border)]" aria-label="Workflow history">
              <thead className="bg-[var(--color-bg-panel)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Prompt</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Network</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Created</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-tertiary)] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredWorkflows.map((w) => (
                  <tr key={w.workflow_id} className="hover:bg-[var(--color-bg-panel)] transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] max-w-xs truncate">
                      {w.intent || w.prompt || w.workflow_id}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.status || "unknown"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">{w.network || "-"}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">
                      {w.created_at ? new Date(w.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            setQuickDemoLoading(w.workflow_id);
                            try {
                              const res = await createQuickDemo(w.workflow_id);
                              if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                            } finally {
                              setQuickDemoLoading(null);
                            }
                          }}
                          disabled={quickDemoLoading !== null}
                          className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50"
                          title="Try in sandbox"
                        >
                          {quickDemoLoading === w.workflow_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        </button>
                        {hasAuditOrSimFailure(w) && (
                          <button
                            type="button"
                            onClick={async () => {
                              setDebugSandboxLoading(w.workflow_id);
                              try {
                                const res = await createDebugSandbox(w.workflow_id);
                                if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
                              } finally {
                                setDebugSandboxLoading(null);
                              }
                            }}
                            disabled={debugSandboxLoading !== null}
                            className="p-1.5 rounded text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                            title="Debug in sandbox"
                          >
                            {debugSandboxLoading === w.workflow_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <Link href={`${ROUTES.HOME}?workflow=${w.workflow_id}`} className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" title="Open workflow">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        filteredLogs.length === 0 ? (
          <EmptyState
            icon={<Filter className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title={search.trim() ? "No matching logs" : "No log entries"}
            description={search.trim() ? `No results for "${search}".` : "Log entries appear after running workflows."}
          />
        ) : (
          <div className="glass-panel rounded-xl p-4 space-y-1 max-h-[600px] overflow-y-auto">
            {filteredLogs.map((log, i) => (
              <div key={log.id || i} className="flex items-start gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  log.level === "error" ? "bg-red-500/10 text-red-400" :
                  log.level === "warn" ? "bg-amber-500/10 text-amber-400" :
                  "bg-[var(--color-bg-panel)] text-[var(--color-text-muted)]"
                }`}>
                  {log.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--color-text-primary)] font-mono break-words">{log.message}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-[var(--color-text-muted)]">
                    {log.service && <span>{log.service}</span>}
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
