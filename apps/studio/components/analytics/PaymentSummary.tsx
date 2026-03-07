"use client";

interface PaymentSummaryProps {
  summary: {
    daily_total: number;
    monthly_total: number;
    transaction_count: number;
    average_amount: number;
    top_merchants: Array<{
      merchant: string;
      total: number;
      count: number;
    }>;
  };
}

import { Card } from '@/components/ui/Card';
import { DollarSign, Calendar, History, TrendingUp } from 'lucide-react'

export function PaymentSummary({ summary }: PaymentSummaryProps) {
  // Safely handle undefined or null values
  const dailyTotal = summary?.daily_total ?? 0;
  const monthlyTotal = summary?.monthly_total ?? 0;
  const transactionCount = summary?.transaction_count ?? 0;
  const averageAmount = summary?.average_amount ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card hover>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-semibold">Daily Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${dailyTotal.toFixed(2)}</p>
        </div>
      </Card>
      
      <Card hover>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-semibold">Monthly Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${monthlyTotal.toFixed(2)}</p>
        </div>
      </Card>
      
      <Card hover>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <History className="w-4 h-4" />
            <span className="text-sm font-semibold">Transactions</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{transactionCount}</p>
        </div>
      </Card>
      
      <Card hover>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-semibold">Average Amount</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${averageAmount.toFixed(2)}</p>
        </div>
      </Card>
    </div>
  );
}

