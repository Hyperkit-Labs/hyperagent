"use client";

import Link from "next/link";
import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { useMetrics } from "@/hooks/useMetrics";
import { useNetworks } from "@/hooks/useNetworks";
import { Shield, FileCheck, AlertTriangle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { EmptyState, NetworkTopologyMap, RadialProgress } from "@/components/ui";
import { Shimmer } from "@/components/ai-elements";

export default function SecurityPage() {
  const { metrics, loading, error, refetch } = useMetrics();
  const { networks } = useNetworks();
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const total = metrics?.workflows?.total ?? 0;
  const completed = metrics?.workflows?.completed ?? 0;
  const failed = metrics?.workflows?.failed ?? 0;
  const hasData = total > 0;

  const mockVulnerabilities = [
    { id: "v1", severity: "High", type: "Reentrancy", contract: "Vault.sol", status: "Open", suggestion: "Use a reentrancy guard modifier or the checks-effects-interactions pattern." },
    { id: "v2", severity: "Medium", type: "Timestamp Dependence", contract: "Lottery.sol", status: "Fixed", suggestion: "Avoid relying on block.timestamp for randomness." },
    { id: "v3", severity: "Low", type: "Floating Pragma", contract: "Token.sol", status: "Open", suggestion: "Lock the pragma version to specific compiler version (e.g., ^0.8.20)." }
  ];

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-panel rounded-xl p-5 flex flex-col items-center justify-center">
                <span className="text-[var(--color-text-tertiary)] text-xs font-medium mb-3">Security Score</span>
                <div className="relative flex items-center justify-center w-24 h-24">
                  <RadialProgress progress={85} size={96} strokeWidth={8} color="var(--color-semantic-success)" />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-[var(--color-semantic-success)]">A-</div>
                </div>
              </div>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(networks?.length ?? 0) > 0 && (
                <div className="glass-panel rounded-xl p-6">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Deployment & Security Map</h3>
                  <p className="text-[var(--color-text-muted)] text-xs mb-4">
                    Red dashed lines indicate networks where OpenSandbox audit detected vulnerabilities.
                  </p>
                  <NetworkTopologyMap
                    centralLabel="Contract"
                    networks={(networks ?? []).map((n: { id: string; name?: string }) => ({ id: n.id, name: n.name ?? n.id }))}
                    vulnerableNetworkIds={failed > 0 ? (networks ?? []).slice(0, 1).map((n: { id: string }) => n.id) : []}
                  />
                </div>
              )}

              <div className="glass-panel rounded-xl p-6 overflow-y-auto">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Vulnerability Breakdown</h3>
                <div className="space-y-3">
                  {mockVulnerabilities.map((vuln) => (
                    <div key={vuln.id} className="bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${vuln.severity === 'High' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : vuln.severity === 'Medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                            {vuln.severity}
                          </span>
                          <span className="text-xs font-medium text-[var(--color-text-primary)]">{vuln.type}</span>
                        </div>
                        <span className={`text-[10px] ${vuln.status === 'Open' ? 'text-amber-400' : 'text-emerald-400'}`}>{vuln.status}</span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-tertiary)] mb-2 font-mono">{vuln.contract}</div>
                      <div className="bg-[var(--color-bg-panel)] p-2 rounded text-[11px] text-[var(--color-text-secondary)]">
                        <span className="text-[var(--color-semantic-violet)] font-medium mr-1">Fix:</span> {vuln.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Audit Report Viewer</h3>
              </div>
              <div className="border border-[var(--color-border-subtle)] rounded-lg overflow-hidden">
                <button 
                  onClick={() => setExpandedReport(expandedReport === 'slither' ? null : 'slither')}
                  className="w-full bg-[var(--color-bg-panel)] p-3 flex items-center justify-between hover:bg-[var(--color-bg-hover)] transition-colors text-xs font-medium text-[var(--color-text-primary)]"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--color-semantic-violet)]" />
                    Slither Report - run_89a3f2b
                  </div>
                  {expandedReport === 'slither' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedReport === 'slither' && (
                  <div className="p-4 bg-[var(--color-bg-base)] text-[11px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {`INFO:Detectors:
Reentrancy in Vault.withdraw(uint256) (contracts/Vault.sol#45-55):
        External calls:
        - payable(msg.sender).call{value: amount}("") (contracts/Vault.sol#50)
        State variables written after the call(s):
        - balances[msg.sender] -= amount (contracts/Vault.sol#53)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-1`}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
