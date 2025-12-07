"use client";

import { useMemo } from "react";

interface PaymentHistoryItem {
  timestamp: string;
  amount: number;
}

interface PaymentChartProps {
  history: PaymentHistoryItem[];
}

export function PaymentChart({ history }: PaymentChartProps) {
  const chartData = useMemo(() => {
    const dailyTotals: { [key: string]: number } = {};
    
    history.forEach((item) => {
      const date = new Date(item.timestamp).toISOString().split("T")[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + item.amount;
    });

    const sortedDates = Object.keys(dailyTotals).sort();
    const maxAmount = Math.max(...Object.values(dailyTotals), 1);

    return sortedDates.map((date) => ({
      date,
      amount: dailyTotals[date],
      percentage: (dailyTotals[date] / maxAmount) * 100,
    }));
  }, [history]);

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
        No payment data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-end justify-between h-64 gap-2">
        {chartData.map((item, index) => (
          <div key={item.date} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
              style={{ height: `${item.percentage}%` }}
              title={`${item.date}: $${item.amount.toFixed(2)}`}
            />
            <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left whitespace-nowrap">
              {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center text-sm text-gray-600">
        Daily spending over time
      </div>
    </div>
  );
}

