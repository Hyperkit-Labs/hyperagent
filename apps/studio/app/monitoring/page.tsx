"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLogs } from "@/hooks/useLogs";
import { useHealth } from "@/hooks/useHealth";
import { FileText, Heart } from "lucide-react";
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
  const logList = filterLogsByParams(
    logs ?? [],
    filters.level,
    filters.timeRange,
    filters.service
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <PageTitle
          title="Logs & Monitoring"
          subtitle={typeLabel ? `${typeLabel} logs and health.` : "Health and log entries."}
        />

        {healthError && (
          <ApiErrorBanner error={healthError} />
        )}
        <div className="flex items-center gap-4">
          <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <Heart className={`w-5 h-5 ${healthError ? "text-red-400" : "text-emerald-400"}`} />
            <div>
              <span className="text-[var(--color-text-tertiary)] text-xs">API Health</span>
              <div className="text-white font-medium">{healthLoading ? "..." : healthError ? "unreachable" : healthStatus ?? "unknown"}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="p-5 border-b border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--color-semantic-violet)]" />
              <h3 className="font-medium text-white text-sm">Logs</h3>
            </div>
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
