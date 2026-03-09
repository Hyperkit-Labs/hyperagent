"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { PaymentHistoryTable } from "@/components/analytics/PaymentHistoryTable";
import { SpendingTrends } from "@/components/analytics/SpendingTrends";
import { SpendingControlCard } from "@/components/settings/SpendingControlCard";
import { PaymentTopUpCard } from "@/components/settings/PaymentTopUpCard";
import { ROUTES } from "@/constants/routes";
import { ArrowRight, TrendingUp } from "lucide-react";
import { usePaymentsDashboard } from "@/hooks/usePaymentsDashboard";
import { cn } from "@/lib/utils";

type PaymentItem = {
  id: string;
  amount: number;
  currency: string;
  merchant: string | null;
  network: string;
  endpoint: string | null;
  transaction_hash: string | null;
  timestamp: string;
  status: string;
};

function normalizeItem(item: {
  id?: string;
  amount?: string | number;
  currency?: string;
  resource_id?: string;
  endpoint?: string;
  network?: string;
  transaction_hash?: string;
  created_at?: string;
  timestamp?: string;
  status?: string;
  [key: string]: unknown;
}): PaymentItem {
  const amount =
    typeof item.amount === "number"
      ? item.amount
      : parseFloat(String(item.amount ?? "0")) || 0;
  return {
    id: String(item.id ?? ""),
    amount,
    currency: String(item.currency ?? "USD"),
    merchant: item.resource_id ? String(item.resource_id) : null,
    network: String(item.network ?? ""),
    endpoint: item.endpoint ? String(item.endpoint) : null,
    transaction_hash: item.transaction_hash ? String(item.transaction_hash) : null,
    timestamp: String(item.created_at ?? item.timestamp ?? ""),
    status: String(item.status ?? "completed"),
  };
}

function PaymentsHeroMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "neutral" | "warning";
}) {
  const accent =
    tone === "primary"
      ? "from-violet-500/70 to-indigo-400/70"
      : tone === "warning"
        ? "from-amber-400/70 to-orange-500/70"
        : "from-slate-400/70 to-slate-500/70";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-slate-900/70 backdrop-blur-md px-4 py-3">
      <div className={cn("absolute inset-0 opacity-30 bg-gradient-to-br", accent)} />
      <div className="relative flex flex-col gap-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xl font-semibold tracking-tight text-slate-100">{value}</span>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, loading, error, refetch } = usePaymentsDashboard({
    page,
    pageSize,
    enabled: true,
  });

  const history = (data?.history.items ?? []).map(normalizeItem);
  const total = data?.history.total ?? 0;
  const summary = data?.summary ?? {};
  const control = data?.control ?? null;
  const balance = data
    ? { balance: data.balance.balance ?? 0, currency: data.balance.currency ?? "USD" }
    : null;
  const stablecoins = data?.stablecoins ?? undefined;

  const balanceValue = balance
    ? `${balance.balance.toLocaleString()} ${balance.currency}`
    : loading ? "..." : "0 USD";
  const spendValue = loading ? "..." : `${summary.total ?? "0"} ${summary.currency ?? "USD"}`;
  const budgetValue = loading ? "..." : `${control?.budget ?? "0"} ${control?.currency ?? "USD"}`;

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-enter">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">
              Payments & Spending
            </h1>
            <p className="text-[var(--color-text-tertiary)] text-sm mt-1">
              x402 payment history, spending trends, and budget controls.
            </p>
          </div>
          <Link
            href={ROUTES.SETTINGS}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-primary-light)]"
          >
            Spending controls in Settings
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <ApiErrorBanner error={error} onRetry={refetch} />

        <div className="grid grid-cols-3 gap-3">
          <PaymentsHeroMetric label="Balance" value={balanceValue} tone="primary" />
          <PaymentsHeroMetric label="This period spend" value={spendValue} tone="neutral" />
          <PaymentsHeroMetric label="Budget" value={budgetValue} tone="warning" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] gap-6">
          <div className="space-y-6">
            <div className="glass-panel rounded-xl p-5">
              <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm mb-4">
                <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
                Payment history
              </h2>
              <PaymentHistoryTable
                history={history}
                page={page}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
            {history.length > 0 && (
              <div className="glass-panel rounded-xl p-5">
                <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm mb-4">
                  Projected burn
                </h2>
                <SpendingTrends
                  history={history.map((h) => ({
                    timestamp: h.timestamp,
                    amount: h.amount,
                    merchant: h.merchant,
                    network: h.network,
                    status: h.status,
                  }))}
                />
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="glass-panel rounded-xl p-5">
              <h2 className="font-medium text-[var(--color-text-primary)] text-sm mb-4">Top up</h2>
              <PaymentTopUpCard
                stablecoinsFromParent={stablecoins}
                onTopUpSuccess={refetch}
              />
            </div>
            <div className="glass-panel rounded-xl p-5">
              <h2 className="font-medium text-[var(--color-text-primary)] text-sm mb-4">
                Spending controls
              </h2>
              <SpendingControlCard
                controlFromParent={control}
                onRefetch={refetch}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
