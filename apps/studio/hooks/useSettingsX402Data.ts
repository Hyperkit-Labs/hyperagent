/**
 * useSettingsX402Data
 *
 * Single batched fetch for Settings x402 tab. Replaces two parallel calls
 * (getCreditsBalance, getSpendingControlWithBudget) with one Promise.all.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCreditsBalance, getSpendingControlWithBudget, type SpendingControlWithBudget } from '@/lib/api';

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

export function useSettingsX402Data(options: UseSettingsX402DataOptions = {}): UseSettingsX402DataReturn {
  const { enabled = true } = options;
  const [balance, setBalance] = useState<{ balance: number; currency: string } | null>(null);
  const [control, setControl] = useState<SpendingControlWithBudget | null>(null);
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
      const [balanceRes, controlRes] = await Promise.all([
        getCreditsBalance().catch(() => ({ balance: 0, currency: 'USD' })),
        getSpendingControlWithBudget().catch(() => null),
      ]);
      setBalance({ balance: balanceRes.balance ?? 0, currency: balanceRes.currency ?? 'USD' });
      setControl(controlRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load x402 data');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return { balance, control, loading, error, refetch: fetchAll };
}
