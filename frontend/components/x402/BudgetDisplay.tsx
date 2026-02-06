'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { getSpendingControlWithBudget, type SpendingControlWithBudget } from '@/lib/api';
import Wallet from 'lucide-react/dist/esm/icons/wallet'
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down'
import { motion } from 'framer-motion';

interface BudgetDisplayProps {
  walletAddress: string;
  className?: string;
}

export function BudgetDisplay({ walletAddress, className }: BudgetDisplayProps) {
  const [budget, setBudget] = useState<SpendingControlWithBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    const fetchBudget = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSpendingControlWithBudget(walletAddress);
        setBudget(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load budget');
        console.error('Error fetching budget:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBudget();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBudget, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 ${className}`}>
        <div className="text-center text-gray-400 py-8">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p>Connect your wallet to view spending budget</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading budget..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 ${className}`}>
        <div className="text-center text-red-400 py-8">
          <p className="font-semibold">Error loading budget</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 ${className}`}>
        <div className="text-center text-gray-400 py-8">
          <p>No spending limits configured</p>
          <p className="text-sm mt-2">Set limits to track your spending</p>
        </div>
      </div>
    );
  }

  const dailyPercentage = budget.daily_limit
    ? Math.min(100, (budget.daily_spent / budget.daily_limit) * 100)
    : 0;
  const monthlyPercentage = budget.monthly_limit
    ? Math.min(100, (budget.monthly_spent / budget.monthly_limit) * 100)
    : 0;

  const isDailyWarning = budget.daily_remaining !== null && budget.daily_remaining < budget.daily_limit! * 0.2;
  const isMonthlyWarning = budget.monthly_remaining !== null && budget.monthly_remaining < budget.monthly_limit! * 0.2;

  return (
    <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-200 ${className}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-400" />
            Spending Budget
          </h3>
          <Badge variant={budget.daily_remaining !== null && budget.daily_remaining > 0 ? 'success' : 'warning'}>
            {budget.daily_remaining !== null && budget.daily_remaining > 0 ? 'Active' : 'No Limits'}
          </Badge>
        </div>

        {/* Daily Budget */}
        {budget.daily_limit && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">Daily Limit</span>
              </div>
              <span className="text-sm font-bold text-white">
                ${budget.daily_spent.toFixed(2)} / ${budget.daily_limit.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dailyPercentage}%` }}
                transition={{ duration: 0.8 }}
                className={`h-full rounded-full ${
                  isDailyWarning
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/20'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Remaining: <span className="font-bold text-white">${budget.daily_remaining?.toFixed(2) || '0.00'}</span>
              </span>
              {budget.daily_remaining !== null && budget.daily_remaining <= 0 && (
                <Badge variant="error" size="sm">
                  Limit Exceeded
                </Badge>
              )}
            </div>
          </motion.div>
        )}

        {/* Monthly Budget */}
        {budget.monthly_limit && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-300">Monthly Limit</span>
              </div>
              <span className="text-sm font-bold text-white">
                ${budget.monthly_spent.toFixed(2)} / ${budget.monthly_limit.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${monthlyPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className={`h-full rounded-full ${
                  isMonthlyWarning
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/20'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Remaining: <span className="font-bold text-white">${budget.monthly_remaining?.toFixed(2) || '0.00'}</span>
              </span>
              {budget.monthly_remaining !== null && budget.monthly_remaining <= 0 && (
                <Badge variant="error" size="sm">
                  Limit Exceeded
                </Badge>
              )}
            </div>
          </motion.div>
        )}

        {!budget.daily_limit && !budget.monthly_limit && (
          <div className="text-center py-4 text-gray-400 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <p>No spending limits configured</p>
            <p className="text-xs mt-1">Configure limits to track your spending</p>
          </div>
        )}
      </div>
    </div>
  );
}

