'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { getSpendingControlWithBudget, type SpendingControlWithBudget } from '@/lib/api';
import { Wallet, DollarSign, Calendar, TrendingDown } from 'lucide-react';
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
      <Card className={className}>
        <div className="text-center text-gray-500 py-8">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Connect your wallet to view spending budget</p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading budget..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="text-center text-red-600 py-8">
          <p className="font-semibold">Error loading budget</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </Card>
    );
  }

  if (!budget) {
    return (
      <Card className={className}>
        <div className="text-center text-gray-500 py-8">
          <p>No spending limits configured</p>
          <p className="text-sm mt-2">Set limits to track your spending</p>
        </div>
      </Card>
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
    <Card hover className={className}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
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
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Daily Limit</span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                ${budget.daily_spent.toFixed(2)} / ${budget.daily_limit.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dailyPercentage}%` }}
                transition={{ duration: 0.8 }}
                className={`h-full rounded-full ${
                  isDailyWarning
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                Remaining: <span className="font-bold text-gray-900">${budget.daily_remaining?.toFixed(2) || '0.00'}</span>
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
                <TrendingDown className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Monthly Limit</span>
              </div>
              <span className="text-sm font-bold text-gray-900">
                ${budget.monthly_spent.toFixed(2)} / ${budget.monthly_limit.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${monthlyPercentage}%` }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className={`h-full rounded-full ${
                  isMonthlyWarning
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                Remaining: <span className="font-bold text-gray-900">${budget.monthly_remaining?.toFixed(2) || '0.00'}</span>
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
          <div className="text-center py-4 text-gray-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No spending limits configured</p>
            <p className="text-xs mt-1">Configure limits to track your spending</p>
          </div>
        )}
      </div>
    </Card>
  );
}

