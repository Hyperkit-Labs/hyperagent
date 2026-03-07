"use client";

import { useState } from "react";
import Link from "next/link";
import { ApiErrorBanner } from "@/components/ApiErrorBanner";
import { PaymentHistoryTable } from "@/components/analytics/PaymentHistoryTable";
import { SpendingTrends } from "@/components/analytics/SpendingTrends";
import { SpendingControlCard } from "@/components/settings/SpendingControlCard";
import { CreditsCard } from "@/components/settings/CreditsCard";
import { PaymentTopUpCard } from "@/components/settings/PaymentTopUpCard";
import { ROUTES } from "@/constants/routes";
import { DollarSign, ArrowRight, CreditCard, TrendingUp } from "lucide-react";
import { usePaymentsDashboard } from "@/hooks/usePaymentsDashboard";

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-xl p-5">
            <CreditsCard
              balanceFromParent={balance}
              onRefetch={refetch}
            />
          </div>
          <div className="glass-panel rounded-xl p-5">
            <PaymentTopUpCard
              stablecoinsFromParent={stablecoins}
              onTopUpSuccess={refetch}
            />
          </div>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 text-[var(--color-text-tertiary)] text-xs font-medium">
              <DollarSign className="w-4 h-4" />
              Total spent
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text-primary)] mt-2">
              {loading ? "..." : `${summary.total ?? "0"} ${summary.currency ?? "USD"}`}
            </div>
            <div className="text-[11px] text-[var(--color-text-dim)] mt-1">
              {typeof summary.total_count === "number" ? summary.total_count : 0} payments
            </div>
          </div>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 text-[var(--color-text-tertiary)] text-xs font-medium">
              <CreditCard className="w-4 h-4" />
              Budget
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text-primary)] mt-2">
              {loading ? "..." : `${control?.budget ?? "0"} ${control?.currency ?? "USD"}`}
            </div>
            <div className="text-[11px] text-[var(--color-text-dim)] mt-1">
              per period
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel rounded-xl p-5">
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
          <div className="glass-panel rounded-xl p-5">
            <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm mb-4">
              Spending controls
            </h2>
            <SpendingControlCard
              controlFromParent={control}
              onRefetch={refetch}
            />
          </div>
        </div>

        {history.length > 0 && (
          <div className="glass-panel rounded-xl p-5">
            <h2 className="font-medium text-[var(--color-text-primary)] flex items-center gap-2 text-sm mb-4">
              Spending trends
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
    </div>
  );
}
