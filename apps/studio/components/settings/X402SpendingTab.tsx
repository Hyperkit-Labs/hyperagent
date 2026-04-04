"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Zap, ExternalLink } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { CreditsCard } from "@/components/settings/CreditsCard";
import { SpendingControlCard } from "@/components/settings/SpendingControlCard";
import type { RuntimeConfig } from "@/lib/api";
import type { SpendingControlWithBudget } from "@/lib/api";

interface X402SpendingTabProps {
  x402Enabled: boolean;
  x402Loading: boolean;
  x402Error: string | null;
  x402Balance: { balance: number; currency: string } | null;
  x402Control: SpendingControlWithBudget | null;
  config: RuntimeConfig | null;
  refetchX402: () => void;
}

const CREDITS_PER_RUN = 1;

export function X402SpendingTab({
  x402Enabled,
  x402Loading,
  x402Error,
  x402Balance,
  x402Control,
  config,
  refetchX402,
}: X402SpendingTabProps) {
  const [liveBudget, setLiveBudget] = useState<string>(
    x402Control?.budget ?? "0",
  );
  const [livePeriod, setLivePeriod] = useState<"daily" | "weekly" | "monthly">(
    (x402Control?.period as "daily" | "weekly" | "monthly") ?? "monthly",
  );
  const creditsPerRun = config?.credits_per_run ?? CREDITS_PER_RUN;

  useEffect(() => {
    setLiveBudget(x402Control?.budget ?? "0");
    setLivePeriod(
      (x402Control?.period as "daily" | "weekly" | "monthly") ?? "monthly",
    );
  }, [x402Control?.budget, x402Control?.period]);

  const projectedRuns = useMemo(() => {
    const budget = parseFloat(liveBudget ?? "0");
    if (Number.isNaN(budget) || budget <= 0) return null;
    const mult = livePeriod === "daily" ? 30 : livePeriod === "weekly" ? 4 : 1;
    const runs = Math.floor((budget * mult) / (creditsPerRun || 1));
    return runs;
  }, [liveBudget, livePeriod, creditsPerRun]);

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] backdrop-blur-md p-4 space-y-4">
      {x402Loading && (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] py-4">
          <Zap className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Loading credits and spending...</span>
        </div>
      )}
      {x402Error && !x402Loading && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-red-400">{x402Error}</p>
          <button
            type="button"
            onClick={() => void refetchX402()}
            className="text-xs text-red-400 underline"
          >
            Retry
          </button>
        </div>
      )}
      {!x402Loading && (
        <>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  x402Enabled
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}
              >
                x402 {x402Enabled ? "enabled" : "disabled"}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {x402Enabled
                  ? "Pay-per-call and credits active."
                  : "x402 payments are disabled (registry or env)."}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {x402Enabled ? (
                <Link
                  href={ROUTES.PAYMENTS}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                >
                  Open payments settings
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                <Link
                  href={ROUTES.NETWORKS}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)]"
                >
                  Configure in registry
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Credits balance
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                Top up with fiat or stablecoins. Each run costs {creditsPerRun}{" "}
                credits.
              </p>
              <CreditsCard
                balanceFromParent={x402Balance}
                onRefetch={refetchX402}
                creditsPerRun={creditsPerRun}
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                Spending controls
              </h3>
              <SpendingControlCard
                controlFromParent={x402Control}
                onRefetch={refetchX402}
                onValuesChange={(budget, period) => {
                  setLiveBudget(budget);
                  setLivePeriod(period);
                }}
              />
              {projectedRuns != null && projectedRuns > 0 && (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                  ~{projectedRuns} runs/month at current prices
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
