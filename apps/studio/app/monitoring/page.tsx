"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLogs } from "@/hooks/useLogs";
import { useHealth } from "@/hooks/useHealth";
import { FileText, Heart, Activity, ShieldCheck, Search, Pause, Play } from "lucide-react";
import { useState, useMemo } from "react";
import { Shimmer, Terminal } from "@/components/ai-elements";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { PageTitle } from "@/components/layout/PageTitle";
import {
  MonitoringFilterBar,
  useMonitoringFilters,
  filterLogsByParams,
} from "@/components/monitoring/MonitoringFilterBar";

const TYPE_LABELS: Record<string, string> = {
  contracts: "Smart Contracts",
  security: "Security",
};

function MonitoringContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") ?? "";
  const typeLabel = TYPE_LABELS[typeParam] ?? "";
  const { logs, loading: logsLoading, error: logsError, refetch: refetchLogs, services } = useLogs();
  const { health, loading: healthLoading, error: healthError } = useHealth();
  const healthStatus = health?.status;
  const filters = useMonitoringFilters();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaused, setIsPaused] = useState(false);

  const baseLogList = filterLogsByParams(
    logs ?? [],
    filters.level,
    filters.timeRange,
    filters.service
  );
  
  const logList = useMemo(() => {
    if (!searchQuery) return baseLogList;
    const q = searchQuery.toLowerCase();
    return baseLogList.filter((log: any) => 
      (log.message || "").toLowerCase().includes(q) || 
      (log.service || "").toLowerCase().includes(q)
    );
  }, [baseLogList, searchQuery]);

  const stats = useMemo(() => {
    const list = logs ?? [];
    const info = list.filter((l: any) => l.level === "info").length;
    const warn = list.filter((l: any) => l.level === "warn").length;
    const err = list.filter((l: any) => l.level === "error").length;
    const total = info + warn + err || 1;
    return { info, warn, err, infoPct: (info/total)*100, warnPct: (warn/total)*100, errPct: (err/total)*100 };
  }, [logs]);

  const recentErrors = useMemo(() => {
    return (logs ?? []).filter((l: any) => l.level === "error").length; // mock last 5 mins
  }, [logs]);

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <PageTitle
          title="Logs & Monitoring"
          subtitle={typeLabel ? `${typeLabel} logs and health.` : "Health and log entries."}
        />

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="glass-panel rounded-xl p-4 flex-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Heart className={`w-5 h-5 ${healthError ? "text-red-400" : "text-emerald-400"}`} />
              <div>
                <span className="text-[var(--color-text-tertiary)] text-xs">API Health</span>
                <div className="text-white font-medium text-sm">{healthLoading ? "..." : healthError ? "unreachable" : healthStatus ?? "healthy"}</div>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--color-border-subtle)]" />
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[var(--color-text-tertiary)] text-xs">Pipeline</span>
                <div className="text-white font-medium text-sm">healthy</div>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--color-border-subtle)]" />
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[var(--color-text-tertiary)] text-xs">Audit Engine</span>
                <div className="text-white font-medium text-sm">healthy</div>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-4 flex-[0.5] flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[var(--color-text-tertiary)] text-xs">Log Severity</span>
              {recentErrors > 0 && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{recentErrors} errors in last 5m</span>}
            </div>
            <div className="flex gap-1 h-2 w-full rounded-full overflow-hidden bg-[var(--color-bg-base)]">
              <div style={{ width: `${stats.infoPct}%` }} className="bg-emerald-500" title={`Info: ${stats.info}`} />
              <div style={{ width: `${stats.warnPct}%` }} className="bg-amber-500" title={`Warn: ${stats.warn}`} />
              <div style={{ width: `${stats.errPct}%` }} className="bg-red-500" title={`Error: ${stats.err}`} />
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border-subtle)] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[var(--color-semantic-violet)]" />
                <h3 className="font-medium text-white text-sm flex items-center gap-2">
                  Logs
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse-glow'}`} />
                    {isPaused ? 'Paused' : 'Live tail'}
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="p-1.5 rounded bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-white transition-colors"
                  title={isPaused ? "Resume stream" : "Pause stream"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between bg-[var(--color-bg-base)] p-2 rounded-lg border border-[var(--color-border-subtle)]">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-[var(--color-text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search logs (regex supported)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none py-1.5 pl-8 pr-3 text-xs text-[var(--color-text-primary)] focus:ring-0 placeholder:text-[var(--color-text-muted)]"
                />
              </div>
              <div className="h-px lg:h-4 w-full lg:w-px bg-[var(--color-border-subtle)]" />
              <MonitoringFilterBar
                services={services}
                level={filters.level}
                timeRange={filters.timeRange}
                service={filters.service}
                onLevelChange={filters.onLevelChange}
                onTimeRangeChange={filters.onTimeRangeChange}
                onServiceChange={filters.onServiceChange}
              />
            </div>
          </div>
          <ApiErrorBanner error={logsError} onRetry={refetchLogs} className="m-5 mb-0" />
          {!logsError && logsLoading && !logList.length && (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Shimmer key={i} height="h-8" width="w-full" rounded="sm" />
              ))}
            </div>
          )}
          {!logsLoading && !logsError && logList.length === 0 && (
            <div className="p-6 text-center text-[var(--color-text-tertiary)]">
              {logs && logs.length > 0 ? "No log entries match your filters." : "No log entries."}
            </div>
          )}
          {!logsLoading && logList.length > 0 && (
            <Terminal
              lines={logList.map((entry: { message?: string; level?: string; timestamp?: string }) => ({
                timestamp: entry.timestamp ?? "",
                level: entry.level ?? "info",
                message: entry.message ?? "",
              }))}
              className="rounded-none border-0 border-t border-[var(--color-border-subtle)] max-h-[500px]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center"><FileText className="w-6 h-6 animate-pulse text-[var(--color-text-muted)]" /></div>}>
      <MonitoringContent />
    </Suspense>
  );
}
