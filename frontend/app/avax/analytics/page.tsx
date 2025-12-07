"use client";

import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { motion } from "framer-motion";
import { SpendingTrends } from "@/components/analytics/SpendingTrends";
import { PaymentHistoryTable } from "@/components/analytics/PaymentHistoryTable";
import { PaymentSummary as PaymentSummaryComponent } from "@/components/analytics/PaymentSummary";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { RefreshCw, TrendingUp } from "lucide-react";
import { getPaymentHistory, getPaymentSummary, type PaymentHistoryItem, type PaymentHistoryResponse, type PaymentSummary } from "@/lib/api";

const REFRESH_INTERVAL = 10000; // 10 seconds
const MAX_HISTORY_FOR_CHARTS = 1000; // Fetch up to 1000 transactions for charts

export default function AnalyticsPage() {
  const account = useActiveAccount();
  const address = account?.address;
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [allHistoryForCharts, setAllHistoryForCharts] = useState<PaymentHistoryItem[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!address) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch paginated history for table
      const historyData = await getPaymentHistory(address, page, pageSize);
      setHistory(historyData.items);
      setTotal(historyData.total);

      // Fetch all history for charts (up to MAX_HISTORY_FOR_CHARTS)
      // Fetch in larger chunks to minimize API calls
      const allPages: PaymentHistoryItem[] = [];
      const chunkSize = 100;
      const maxPages = Math.ceil(MAX_HISTORY_FOR_CHARTS / chunkSize);
      
      try {
        // Fetch first page to get total count
        const firstPageData = await getPaymentHistory(address, 1, chunkSize);
        allPages.push(...firstPageData.items);
        
        // If we have more data and haven't reached the limit, fetch more pages in parallel
        if (firstPageData.total > chunkSize && allPages.length < MAX_HISTORY_FOR_CHARTS) {
          const remainingPages = Math.min(
            Math.ceil((firstPageData.total - chunkSize) / chunkSize),
            maxPages - 1
          );
          
          // Fetch remaining pages in parallel (but limit concurrency)
          const pagePromises: Promise<PaymentHistoryResponse>[] = [];
          for (let i = 2; i <= remainingPages + 1 && allPages.length < MAX_HISTORY_FOR_CHARTS; i++) {
            pagePromises.push(getPaymentHistory(address, i, chunkSize));
          }
          
          // Use Promise.allSettled to handle partial failures gracefully
          const pageResults = await Promise.allSettled(pagePromises);
          pageResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              allPages.push(...result.value.items);
            } else {
              console.warn('Failed to fetch payment history page:', result.reason);
            }
          });
        }

        setAllHistoryForCharts(allPages.slice(0, MAX_HISTORY_FOR_CHARTS));
      } catch (error) {
        console.error('Error fetching payment history for charts:', error);
        // Still set what we have, even if incomplete
        setAllHistoryForCharts(allPages);
      }

      // Fetch summary
      const summaryData = await getPaymentSummary(address);
      setSummary(summaryData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [address, page]);

  // Initial fetch and when address/page changes
  useEffect(() => {
    if (address) {
      fetchData();
    }
  }, [address, page, fetchData]);

  // Auto-refresh every REFRESH_INTERVAL
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchData(true); // Refresh in background
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [address, fetchData]);

  const handleManualRefresh = () => {
    fetchData(true);
  };

  if (!address) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">Please connect your wallet to view payment analytics</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Payment Analytics
          </h1>
          <p className="text-gray-600 mt-2">Comprehensive spending analysis and trends</p>
        </div>
        <Button
          onClick={handleManualRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      ) : (
        <>
          {summary && <PaymentSummaryComponent summary={summary} />}
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Spending Trends</h2>
            <SpendingTrends history={allHistoryForCharts} summary={summary || undefined} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
              <div className="text-sm text-gray-600">
                Showing {history.length} of {total} transactions
              </div>
            </div>
            <PaymentHistoryTable
              history={history}
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}
