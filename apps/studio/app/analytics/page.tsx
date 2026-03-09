"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMetrics } from "@/hooks/useMetrics";
import { Activity, TrendingUp, Globe, Shield, CheckCircle, XCircle, Loader2, Zap, BarChart3 } from "lucide-react";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState } from "@/components/ui";
import { ROUTES } from "@/constants/routes";

interface WorkflowMetrics {
  total?: number;
  active?: number;
  completed?: number;
  failed?: number;
}

const VIEW_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  project: { label: "Project", icon: Activity },
  network: { label: "Network", icon: Globe },
  security: { label: "Security", icon: Shield },
};

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-tertiary)]">{label}</span>
        <span className="font-mono text-[var(--color-text-primary)]">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-[var(--color-bg-panel)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="glass-panel p-5 rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-[var(--color-text-tertiary)] text-xs font-medium">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-semibold text-white mt-2">{value}</div>
    </div>
  );
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "project";
  const viewConfig = VIEW_LABELS[view] ?? VIEW_LABELS.project;
  const { metrics, loading, error, refetch } = useMetrics();
  const m = metrics && typeof metrics === "object" ? (metrics as unknown as Record<string, unknown>) : {};
  const wf = (m.workflows || {}) as WorkflowMetrics;
  const total = wf.total || 0;
  const active = wf.active || 0;
  const completed = wf.completed || 0;
  const failed = wf.failed || 0;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">
              {viewConfig.label} metrics and platform overview.
            </p>
          </div>
          <div className="flex gap-1">
            {Object.entries(VIEW_LABELS).map(([v, { label }]) => (
              <Link
                key={v}
                href={`${ROUTES.ANALYTICS}?view=${v}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view === v
                    ? "bg-[var(--color-primary-alpha-20)] text-[var(--color-primary-light)]"
                    : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <ApiErrorBanner error={error} onRetry={refetch} />

        {!loading && !error && total === 0 && (
          <EmptyState
            icon={<BarChart3 className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title="No analytics data"
            description="Analytics data appears after your first workflow run. Create a workflow to start generating metrics."
            action={
              <Link href={ROUTES.HOME} className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg">
                Create workflow
              </Link>
            }
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total workflows" value={loading ? "..." : total} icon={Activity} color="text-[var(--color-semantic-violet)]" />
          <MetricCard label="Active" value={loading ? "..." : active} icon={Loader2} color="text-blue-400" />
          <MetricCard label="Completed" value={loading ? "..." : completed} icon={CheckCircle} color="text-green-400" />
          <MetricCard label="Failed" value={loading ? "..." : failed} icon={XCircle} color="text-red-400" />
        </div>

        {view === "project" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-medium text-white text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-semantic-info)]" />
                Workflow breakdown
              </h3>
              <div className="space-y-4">
                <BarSegment label="Completed" value={completed} total={total} color="bg-green-500" />
                <BarSegment label="Active" value={active} total={total} color="bg-blue-500" />
                <BarSegment label="Failed" value={failed} total={total} color="bg-red-500" />
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-medium text-white text-sm mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-tertiary)]">Success rate</span>
                  <span className={`text-lg font-semibold ${successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {successRate}%
                  </span>
                </div>
                <div className="h-3 bg-[var(--color-bg-panel)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${successRate >= 80 ? "bg-green-500" : successRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${successRate}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-panel rounded-lg p-3 text-center">
                    <div className="text-xl font-semibold text-white">{total}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Total runs</div>
                  </div>
                  <div className="glass-panel rounded-lg p-3 text-center">
                    <div className="text-xl font-semibold text-white">{completed + active}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">Non-failed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "network" && (
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-medium text-white text-sm mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--color-semantic-info)]" />
              Network activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-[var(--color-border-subtle)]">
                <div>
                  <span className="text-sm font-medium text-white">SKALE Base Sepolia</span>
                  <p className="text-xs text-[var(--color-text-muted)]">Primary testnet (Phase 1)</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-white">{total}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">deployments</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              Multi-chain analytics will be available when additional networks are enabled.
            </p>
          </div>
        )}

        {view === "security" && (
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-medium text-white text-sm mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              Security overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel rounded-lg p-4 text-center">
                <div className="text-xl font-semibold text-green-400">{completed}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Passed audit</div>
              </div>
              <div className="glass-panel rounded-lg p-4 text-center">
                <div className="text-xl font-semibold text-red-400">{failed}</div>
                <div className="text-xs text-[var(--color-text-muted)]">Failed audit</div>
              </div>
              <div className="glass-panel rounded-lg p-4 text-center">
                <div className="text-xl font-semibold text-white">{successRate}%</div>
                <div className="text-xs text-[var(--color-text-muted)]">Pass rate</div>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              Audits use Slither and Mythril for static analysis. Tenderly simulations validate behavior before deployment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-6 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" /></div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
