"use client";

import { getExplorerUrl } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  merchant: string | null;
  network: string;
  endpoint: string | null;
  transaction_hash: string | null;
  timestamp: string;
  status: string;
}

interface PaymentHistoryTableProps {
  history: PaymentHistoryItem[];
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function PaymentHistoryTable({
  history,
  page,
  total,
  pageSize,
  onPageChange,
}: PaymentHistoryTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (history.length === 0) {
    return (
      <div
        className="glass-panel rounded-lg p-8 text-center text-[var(--color-text-muted)]"
        role="status"
      >
        No payment history available
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="min-w-full divide-y divide-[var(--color-border)]"
          aria-label="Payment history"
        >
          <thead className="bg-[var(--color-bg-panel)]">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Merchant
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Network
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Transaction
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {history.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-[var(--color-bg-panel)] transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-primary)]">
                  {new Date(item.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--color-text-primary)]">
                  ${item.amount.toFixed(2)} {item.currency}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {item.merchant || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                  {item.network}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {item.transaction_hash ? (
                    (() => {
                      const explorerUrl = getExplorerUrl(
                        item.network,
                        "tx",
                        item.transaction_hash,
                      );
                      return explorerUrl ? (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-primary-light)] hover:underline font-mono"
                        >
                          {item.transaction_hash.slice(0, 10)}...
                          {item.transaction_hash.slice(-6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)] font-mono">
                          {item.transaction_hash.slice(0, 10)}...
                          {item.transaction_hash.slice(-6)}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[var(--color-text-muted)]">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      item.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : item.status === "pending"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="bg-[var(--color-bg-panel)] px-4 py-3 flex items-center justify-between border-t border-[var(--color-border)]">
          <div className="text-sm text-[var(--color-text-tertiary)]">
            Showing {(page - 1) * pageSize + 1} to{" "}
            {Math.min(page * pageSize, total)} of {total} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] glass-panel rounded-md hover:bg-[var(--color-bg-panel)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] glass-panel rounded-md hover:bg-[var(--color-bg-panel)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
