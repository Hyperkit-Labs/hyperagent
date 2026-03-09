"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import type { PricingPlan, PricingResource, UsageSummary } from "@/lib/api";

interface PlanPricingTabProps {
  plans: PricingPlan[];
  resources: PricingResource[];
  usage: UsageSummary | null;
  planLoading: boolean;
  planError: string | null;
  refetchPlan: () => void;
}

export function PlanPricingTab({
  plans,
  resources,
  usage,
  planLoading,
  planError,
  refetchPlan,
}: PlanPricingTabProps) {
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);

  const primaryUsageKey = usage ? Object.keys(usage.usage)[0] : null;
  const primaryVal = primaryUsageKey ? usage?.usage[primaryUsageKey] ?? 0 : 0;
  const primaryLimit = primaryUsageKey ? usage?.limits[primaryUsageKey] : null;
  const usagePct = primaryLimit ? Math.min(100, (primaryVal / primaryLimit) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] backdrop-blur-md p-4 space-y-4">
      {planLoading && (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-4">
          <Zap className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading plan information...</span>
        </div>
      )}
      {planError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-red-400">{planError}</p>
          <button type="button" onClick={refetchPlan} className="text-xs text-red-400 underline">
            Retry
          </button>
        </div>
      )}
      {!planLoading && !planError && (
        <>
          {usage && (
            <div className="flex items-center gap-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{usage.plan_name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {primaryVal}
                    {primaryLimit ? ` / ${primaryLimit}` : ""} {primaryUsageKey ?? ""}
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-panel)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-primary-light)] rounded-full transition-all duration-300"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 px-3 py-1.5 rounded-full bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90"
              >
                Upgrade
              </button>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Plans</h3>
            <div className="overflow-x-auto overflow-y-hidden -mx-1 pb-2">
              <div className="flex gap-4 min-w-max">
                {plans.map((plan) => {
                  const isCurrent = usage?.plan === plan.id;
                  const isHovered = hoveredPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onMouseEnter={() => setHoveredPlanId(plan.id)}
                      onMouseLeave={() => setHoveredPlanId(null)}
                      className={`w-[200px] shrink-0 rounded-xl border p-4 space-y-3 transition-all duration-200 ${
                        isCurrent
                          ? "border-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-light)] bg-[var(--color-primary-alpha-10)]"
                          : isHovered
                            ? "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]"
                            : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--color-text-primary)]">{plan.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-alpha-20)] text-[var(--color-primary-light)] font-medium">
                            Current
                          </span>
                        )}
                      </div>
                      <ul className="text-xs text-[var(--color-text-tertiary)] space-y-1">
                        {Object.entries(plan.limits).map(([resource, limit]) => (
                          <li key={resource} className="flex justify-between">
                            <span>{resource}</span>
                            <span className="font-mono">{typeof limit === "number" ? limit.toLocaleString() : "Unlimited"}</span>
                          </li>
                        ))}
                        {Object.keys(plan.limits).length === 0 && (
                          <li className="text-[var(--color-primary-light)]">Unlimited</li>
                        )}
                      </ul>
                      {plan.features.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {plan.features.map((f) => (
                            <span
                              key={f}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition-all duration-200 ${
                                isHovered || isCurrent
                                  ? "bg-[var(--color-bg-panel)] text-[var(--color-text-secondary)] opacity-100"
                                  : "bg-[var(--color-bg-panel)] text-[var(--color-text-muted)] opacity-70"
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {resources.length > 0 && (
            <div className="w-full">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Resource pricing</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)]">
                    <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Resource</th>
                    <th className="text-left py-2 text-[var(--color-text-muted)] font-medium">Unit</th>
                    <th className="text-right py-2 text-[var(--color-text-muted)] font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-bg-elevated)]">
                      <td className="py-2">
                        <div className="text-[var(--color-text-primary)]">{r.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{r.description}</div>
                      </td>
                      <td className="py-2 text-[var(--color-text-tertiary)]">{r.unit}</td>
                      <td className="py-2 text-right font-mono text-[var(--color-text-primary)]">${r.unit_price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
