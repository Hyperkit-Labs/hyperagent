'use client';

import { useEffect, useState } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BudgetDisplay } from '@/components/x402/BudgetDisplay';
import { PaymentHistoryTable } from '@/components/analytics/PaymentHistoryTable';
import { getPaymentHistory, getPaymentSummary, type PaymentHistoryItem, type PaymentSummary } from '@/lib/api';
import { Wallet, History, TrendingUp, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PaymentsPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [historyData, summaryData] = await Promise.all([
          getPaymentHistory(address, page, pageSize),
          getPaymentSummary(address),
        ]);

        setHistory(historyData.items);
        setTotal(historyData.total);
        setSummary(summaryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load payment data');
        console.error('Error fetching payment data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address, page]);

  if (!address) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">Connect your wallet to view payment history and spending analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <History className="w-8 h-8 text-blue-600" />
            Payment History & Analytics
          </h1>
          <p className="text-gray-600 mt-2">Track your x402 payments and spending</p>
        </div>
      </motion.div>

      {/* Budget Display */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <BudgetDisplay walletAddress={address} />
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <Card hover>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-semibold">Today</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${summary.daily_total.toFixed(2)}</p>
            </div>
          </Card>

          <Card hover>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-semibold">This Month</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${summary.monthly_total.toFixed(2)}</p>
            </div>
          </Card>

          <Card hover>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <History className="w-4 h-4" />
                <span className="text-sm font-semibold">Transactions</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{summary.transaction_count}</p>
            </div>
          </Card>

          <Card hover>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm font-semibold">Average</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${summary.average_amount.toFixed(2)}</p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Payment History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Recent Payments
            </h2>
            <p className="text-sm text-gray-600 mt-1">Last {pageSize} transactions</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="Loading payment history..." />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-semibold mb-2">Error loading payment history</p>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          ) : (
            <PaymentHistoryTable
              history={history}
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          )}
        </Card>
      </motion.div>
    </div>
  );
}

