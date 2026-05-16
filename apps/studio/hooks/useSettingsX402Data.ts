/**
 * useSettingsX402Data
 *
 * Single batched fetch for Settings x402 tab. Replaces two parallel calls
 * (getCreditsBalance, getSpendingControlWithBudget) with one Promise.all.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCreditsBalance,
  getSpendingControlWithBudget,
  getErrorMessage,
  type SpendingControlWithBudget,
} from "@/lib/api";
import {
  CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
  withAsyncTimeout,
} from "@/lib/runtime-timeouts";

export interface UseSettingsX402DataOptions {
  enabled?: boolean;
}

export interface UseSettingsX402DataReturn {
  balance: { balance: number; currency: string } | null;
  control: SpendingControlWithBudget | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSettingsX402Data(
  options: UseSettingsX402DataOptions = {},
): UseSettingsX402DataReturn {
  const { enabled = true } = options;
  const [balance, setBalance] = useState<{
    balance: number;
    currency: string;
  } | null>(null);
  const [control, setControl] = useState<SpendingControlWithBudget | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [balanceRes, controlRes] = await Promise.allSettled([
        withAsyncTimeout(
          getCreditsBalance(),
          CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
          "Credits balance",
        ),
        withAsyncTimeout(
          getSpendingControlWithBudget(),
          CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
          "Spending controls",
        ),
      ]);
      if (balanceRes.status === "fulfilled") {
        setBalance({
          balance: balanceRes.value.balance ?? 0,
          currency: balanceRes.value.currency ?? "USD",
        });
      } else {
        setBalance(null);
      }
      if (controlRes.status === "fulfilled") {
        setControl(controlRes.value);
      } else {
        setControl(null);
      }

      const failures = [balanceRes, controlRes]
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )
        .map((result) =>
          getErrorMessage(result.reason, "Failed to load x402 data"),
        );
      if (failures.length > 0) {
        setError(failures.join("\n"));
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load x402 data"));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { balance, control, loading, error, refetch: fetchAll };
}
