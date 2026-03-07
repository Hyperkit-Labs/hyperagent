"use client";

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { useMetrics } from "@/hooks/useMetrics";
import { Shield, FileCheck, AlertTriangle, Loader2 } from "lucide-react";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState } from "@/components/ui";
import { Shimmer } from "@/components/ai-elements";

export default function SecurityPage() {
  const { metrics, loading, error, refetch } = useMetrics();
  const total = metrics?.workflows?.total ?? 0;
  const completed = metrics?.workflows?.completed ?? 0;
  const failed = metrics?.workflows?.failed ?? 0;
  const hasData = total > 0;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Security</h1>
              <p className="text-xs text-[var(--color-text-tertiary)]">Audit and security overview from the pipeline</p>
            </div>
          </div>
        </div>

        <ApiErrorBanner error={error} onRetry={refetch} />

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && !error && !hasData && (
          <EmptyState
            icon={<Shield className="w-8 h-8 text-[var(--color-text-muted)]" />}
            title="No security data"
            description="Security findings appear after running the audit pipeline. Create a workflow to generate your first audit report."
            action={
              <Link href={ROUTES.HOME} className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg">
                Create workflow
              </Link>
            }
          />
        )}

        {!loading && hasData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel rounded-xl p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-[var(--color-semantic-violet)]" />
                  <span className="text-[var(--color-text-tertiary)] text-xs font-medium">Total audits</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">{total}</div>
                <p className="text-[10px] text-[var(--color-text-dim)] mt-1">Audit runs per workflow</p>
              </div>
              <div className="glass-panel rounded-xl p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  <span className="text-[var(--color-text-tertiary)] text-xs font-medium">Passed</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">{completed}</div>
                <p className="text-[10px] text-[var(--color-text-dim)] mt-1">Passed audit and simulation</p>
              </div>
              <div className="glass-panel rounded-xl p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span className="text-[var(--color-text-tertiary)] text-xs font-medium">Failed</span>
                </div>
                <div className="text-2xl font-semibold text-[var(--color-text-primary)]">{failed}</div>
                <p className="text-[10px] text-[var(--color-text-dim)] mt-1">Audit or simulation failed</p>
              </div>
            </div>
            <div className="glass-panel rounded-xl p-6">
              <p className="text-[var(--color-text-tertiary)] text-sm">
                Security audits run as part of each workflow pipeline. View detailed findings and status on the workflow detail page.
              </p>
              <Link href={ROUTES.WORKFLOWS} className="mt-3 inline-block text-[var(--color-primary-light)] hover:underline text-sm font-medium">
                View workflows
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
