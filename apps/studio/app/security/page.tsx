"use client";

import Link from "next/link";
import { useState } from "react";
import { RequireApiSession } from "@/components/auth/RequireApiSession";
import { ROUTES } from "@/constants/routes";
import { useMetrics } from "@/hooks/useMetrics";
import { useNetworks } from "@/hooks/useNetworks";
import { useSecurityFindings } from "@/hooks/useSecurityFindings";
import {
  Shield,
  FileCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import {
  EmptyState,
  NetworkTopologyMap,
  RadialProgress,
} from "@/components/ui";
import { Shimmer } from "@/components/ai-elements";

export default function SecurityPage() {
  const { metrics, loading, error, refetch } = useMetrics();
  const {
    findings,
    loading: findingsLoading,
    error: findingsError,
    refetch: refetchFindings,
  } = useSecurityFindings({ limit: 100 });
  const { networks } = useNetworks();
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const total = metrics?.workflows?.total ?? 0;
  const completed = metrics?.workflows?.completed ?? 0;
  const failed = metrics?.workflows?.failed ?? 0;
  const hasData = total > 0;
  const securityScore = metrics?.security?.score ?? null;
  const hasFindings = findings.length > 0;

  return (
    <RequireApiSession>
      <div className="p-6 lg:p-8">
        <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Security
                </h1>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Audit and security overview from the pipeline
                </p>
              </div>
            </div>
          </div>

          <ApiErrorBanner
            error={error ?? findingsError}
            onRetry={() => {
              refetch();
              refetchFindings();
            }}
          />

          {(loading || findingsLoading) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Shimmer key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && !error && !hasData && (
            <EmptyState
              icon={
                <Shield className="w-8 h-8 text-[var(--color-text-muted)]" />
              }
              title="No security data"
              description="Security findings appear after running the audit pipeline. Create a workflow to generate your first audit report."
              action={
                <Link
                  href={ROUTES.HOME}
                  className="btn-primary-gradient text-xs px-4 py-1.5 rounded-lg"
                >
                  Create workflow
                </Link>
              }
            />
          )}

          {!loading && hasData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel rounded-xl p-5 flex flex-col items-center justify-center">
                  <span className="text-[var(--color-text-tertiary)] text-xs font-medium mb-3">
                    Security Score
                  </span>
                  <div className="relative flex items-center justify-center w-24 h-24">
                    {securityScore != null && securityScore > 0 ? (
                      <>
                        <RadialProgress
                          progress={securityScore}
                          size={96}
                          strokeWidth={8}
                          color="var(--color-semantic-success)"
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[var(--color-semantic-success)]">
                          {securityScore >= 90
                            ? "A"
                            : securityScore >= 80
                              ? "B"
                              : securityScore >= 70
                                ? "C"
                                : "D"}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm text-[var(--color-text-muted)]">
                        —
                      </span>
                    )}
                  </div>
                </div>
                <div className="glass-panel rounded-xl p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-[var(--color-semantic-violet)]" />
                    <span className="text-[var(--color-text-tertiary)] text-xs font-medium">
                      Total audits
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {total}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-dim)] mt-1">
                    Audit runs per workflow
                  </p>
                </div>
                <div className="glass-panel rounded-xl p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-[var(--color-text-tertiary)] text-xs font-medium">
                      Passed
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {completed}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-dim)] mt-1">
                    Passed audit and simulation
                  </p>
                </div>
                <div className="glass-panel rounded-xl p-5 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <span className="text-[var(--color-text-tertiary)] text-xs font-medium">
                      Failed
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {failed}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-dim)] mt-1">
                    Audit or simulation failed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {(networks?.length ?? 0) > 0 && (
                  <div className="glass-panel rounded-xl p-6">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
                      Deployment & Security Map
                    </h3>
                    <p className="text-[var(--color-text-muted)] text-xs mb-4">
                      Red dashed lines indicate networks where OpenSandbox audit
                      detected vulnerabilities.
                    </p>
                    <NetworkTopologyMap
                      centralLabel="Contract"
                      networks={(networks ?? []).map(
                        (n: { id: string; name?: string }) => ({
                          id: n.id,
                          name: n.name ?? n.id,
                        }),
                      )}
                      vulnerableNetworkIds={
                        failed > 0
                          ? (networks ?? [])
                              .slice(0, 1)
                              .map((n: { id: string }) => n.id)
                          : []
                      }
                    />
                  </div>
                )}

                <div className="glass-panel rounded-xl p-6 overflow-y-auto">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
                    Vulnerability Breakdown
                  </h3>
                  <div className="space-y-3">
                    {hasFindings ? (
                      findings.map((vuln) => (
                        <div
                          key={
                            vuln.id ??
                            vuln.run_id ??
                            `vuln-${findings.indexOf(vuln)}`
                          }
                          className="bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-medium ${(vuln.severity ?? "").toLowerCase() === "high" || (vuln.severity ?? "").toLowerCase() === "critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" : (vuln.severity ?? "").toLowerCase() === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}
                              >
                                {vuln.severity ?? "Info"}
                              </span>
                              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                                {vuln.category ??
                                  vuln.title ??
                                  vuln.tool ??
                                  "Finding"}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] ${(vuln.status ?? "open").toLowerCase() === "open" || (vuln.status ?? "").toLowerCase() === "fixed" ? ((vuln.status ?? "").toLowerCase() === "fixed" ? "text-emerald-400" : "text-amber-400") : "text-[var(--color-text-tertiary)]"}`}
                            >
                              {vuln.status ?? "Open"}
                            </span>
                          </div>
                          {(vuln.location ?? vuln.title) && (
                            <div className="text-[10px] text-[var(--color-text-tertiary)] mb-2 font-mono">
                              {vuln.location ?? vuln.title}
                            </div>
                          )}
                          {vuln.description && (
                            <div className="bg-[var(--color-bg-panel)] p-2 rounded text-[11px] text-[var(--color-text-secondary)]">
                              <span className="text-[var(--color-semantic-violet)] font-medium mr-1">
                                Fix:
                              </span>{" "}
                              {vuln.description}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        No security findings yet. Run an audit pipeline to see
                        results.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    Audit Report Viewer
                  </h3>
                </div>
                <div className="border border-[var(--color-border-subtle)] rounded-lg overflow-hidden">
                  {hasFindings ? (
                    findings.slice(0, 5).map((f, i) => {
                      const key = f.id ?? f.run_id ?? `f-${i}`;
                      const reportId = `${f.tool ?? "audit"}-${(f.run_id ?? "").slice(0, 8)}`;
                      const isExpanded = expandedReport === key;
                      return (
                        <div
                          key={key}
                          className="border-b border-[var(--color-border-subtle)] last:border-b-0"
                        >
                          <button
                            onClick={() =>
                              setExpandedReport(isExpanded ? null : key)
                            }
                            className="w-full bg-[var(--color-bg-panel)] p-3 flex items-center justify-between hover:bg-[var(--color-bg-hover)] transition-colors text-xs font-medium text-[var(--color-text-primary)]"
                          >
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-[var(--color-semantic-violet)]" />
                              {f.tool ?? "Audit"} Report - {reportId}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="p-4 bg-[var(--color-bg-base)] text-[11px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">
                              {[f.title, f.category, f.description, f.location]
                                .filter(Boolean)
                                .join("\n\n") || "No details available."}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 bg-[var(--color-bg-panel)] text-xs text-[var(--color-text-muted)]">
                      No audit reports yet. Run the audit pipeline to generate
                      Slither and other tool reports.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </RequireApiSession>
  );
}
