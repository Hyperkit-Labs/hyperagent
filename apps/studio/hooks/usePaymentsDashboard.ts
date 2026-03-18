/**
 * usePaymentsDashboard
 *
 * Single consolidated fetch for Payments page data. Replaces multiple parallel
 * calls (history, summary, control, balance, stablecoins) with one batched request.
 * Production pattern: lift data fetching to page level, pass to children as props.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getPaymentHistory,
  getPaymentSummary,
  getSpendingControlWithBudget,
  getCreditsBalance,
  getStablecoins,
  type PaymentHistoryResponse,
  type PaymentSummary,
  type SpendingControlWithBudget,
  type CreditsBalance,
} from '@/lib/api';

export type StablecoinsMap = Record<string, { USDC?: string; USDT?: string }>;

export interface PaymentsDashboardData {
  history: PaymentHistoryResponse;
  summary: PaymentSummary;
  control: SpendingControlWithBudget | null;
  balance: CreditsBalance;
  stablecoins: StablecoinsMap;
}

export interface UsePaymentsDashboardOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface UsePaymentsDashboardReturn {
  data: PaymentsDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePaymentsDashboard(
  options: UsePaymentsDashboardOptions = {}
): UsePaymentsDashboardReturn {
  const {
    page = 1,
    pageSize = 20,
    enabled = true,
  } = options;

  const [data, setData] = useState<PaymentsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [historyRes, summaryRes, controlRes, balanceRes, stablecoinsRes] = await Promise.all([
        getPaymentHistory({ limit: pageSize, offset: (page - 1) * pageSize }),
        getPaymentSummary(),
        getSpendingControlWithBudget(),
        getCreditsBalance(),
        getStablecoins(),
      ]);
      setData({
        history: historyRes,
        summary: summaryRes,
        control: controlRes,
        balance: balanceRes,
        stablecoins: stablecoinsRes ?? {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [enabled, page, pageSize]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => void fetchAll(), 60_000);
    return () => clearInterval(interval);
  }, [enabled, fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
