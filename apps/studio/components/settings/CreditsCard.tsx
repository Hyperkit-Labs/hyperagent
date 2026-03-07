"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, Loader2, Plus } from "lucide-react";
import { getCreditsBalance, topUpCredits, handleApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";

export interface CreditsCardProps {
  /** Increment to trigger a refetch (e.g. after on-chain top-up). */
  refetchTrigger?: number;
}

export function CreditsCard({ refetchTrigger = 0 }: CreditsCardProps) {
  const [balance, setBalance] = useState<{ balance: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);
  const { hasSession } = useSession();

  const fetchBalance = useCallback(() => {
    setError(null);
    setLoading(true);
    getCreditsBalance()
      .then((res) => {
        setBalance({ balance: res.balance ?? 0, currency: res.currency ?? "USD" });
      })
      .catch((e) => setError(handleApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasSession) fetchBalance();
    else setLoading(false);
  }, [hasSession, fetchBalance, refetchTrigger]);

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    if (!hasSession || Number.isNaN(amount) || amount <= 0) return;
    setToppingUp(true);
    setError(null);
    topUpCredits({ amount, currency: "USD", reference_type: "manual" })
      .then((res) => {
        setBalance({ balance: res.balance ?? 0, currency: res.currency ?? "USD" });
        setTopUpAmount("");
      })
      .catch((e) => setError(handleApiError(e)))
      .finally(() => setToppingUp(false));
  };

  if (!hasSession) {
    return (
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Coins className="w-5 h-5" />
          <h3 className="text-sm font-medium">Credits</h3>
        </div>
        <p className="text-sm text-[var(--color-text-tertiary)] mt-2">Sign in to view and top up credits.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-5 h-5 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Credits</h3>
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Top up with fiat or stablecoins (USDC/USDT). Each workflow run consumes credits. x402 is used for external pay-per-call.
      </p>
      {error && <ApiErrorBanner error={error} onRetry={fetchBalance} />}
      {loading ? (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading balance...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">Balance</span>
            <span className="text-lg font-semibold text-[var(--color-text-primary)]">
              {balance?.balance ?? 0} {balance?.currency ?? "USD"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="1"
              step="1"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              placeholder="Amount"
              className="w-24 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-default)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleTopUp}
              disabled={toppingUp || !topUpAmount.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50 disabled:pointer-events-none"
            >
              {toppingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Top up
            </button>
          </div>
        </>
      )}
    </div>
  );
}
