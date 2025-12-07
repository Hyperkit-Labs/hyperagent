'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { TrendingUp, DollarSign, Calendar, PieChart as PieChartIcon } from 'lucide-react';

interface PaymentHistoryItem {
  timestamp: string;
  amount: number;
  merchant: string | null;
  network: string;
  status: string;
}

interface SpendingTrendsProps {
  history: PaymentHistoryItem[];
  summary?: {
    top_merchants: Array<{
      merchant: string;
      total: number;
      count: number;
    }>;
  };
}

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export function SpendingTrends({ history, summary }: SpendingTrendsProps) {
  // Process data for daily spending line chart
  const dailyData = useMemo(() => {
    const dailyTotals: { [key: string]: number } = {};
    
    history
      .filter((item) => item.status === 'completed')
      .forEach((item) => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        dailyTotals[date] = (dailyTotals[date] || 0) + item.amount;
      });

    return Object.keys(dailyTotals)
      .sort()
      .map((date) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        amount: dailyTotals[date],
      }));
  }, [history]);

  // Process data for cumulative spending area chart
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return dailyData.map((item) => {
      cumulative += item.amount;
      return {
        ...item,
        cumulative,
      };
    });
  }, [dailyData]);

  // Process data for weekly/monthly bar chart
  const weeklyData = useMemo(() => {
    const weeklyTotals: { [key: string]: number } = {};
    
    history
      .filter((item) => item.status === 'completed')
      .forEach((item) => {
        const date = new Date(item.timestamp);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + item.amount;
      });

    return Object.keys(weeklyTotals)
      .sort()
      .slice(-8) // Last 8 weeks
      .map((weekKey) => {
        const weekStart = new Date(weekKey);
        return {
          week: `Week ${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          amount: weeklyTotals[weekKey],
        };
      });
  }, [history]);

  // Process data for merchant distribution pie chart
  const merchantData = useMemo(() => {
    if (!summary?.top_merchants || summary.top_merchants.length === 0) {
      return [];
    }

    return summary.top_merchants.slice(0, 6).map((merchant) => ({
      name: merchant.merchant || 'Unknown',
      value: merchant.total,
      count: merchant.count,
    }));
  }, [summary]);

  if (history.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No payment data available for spending trends</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Spending Line Chart */}
      <Card>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900">Daily Spending Trend</h3>
          </div>
          <p className="text-sm text-gray-600">Track your daily payment amounts over time</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Daily Spending"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Cumulative Spending Area Chart */}
      <Card>
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-gray-900">Cumulative Spending</h3>
          </div>
          <p className="text-sm text-gray-600">Total spending accumulation over time</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={cumulativeData}>
            <defs>
              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative']}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#colorCumulative)"
              name="Cumulative Total"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Spending Bar Chart */}
        <Card>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">Weekly Spending</h3>
            </div>
            <p className="text-sm text-gray-600">Last 8 weeks breakdown</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="week" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Weekly Total']}
              />
              <Legend />
              <Bar dataKey="amount" fill="#8b5cf6" name="Weekly Spending" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Merchant Distribution Pie Chart */}
        <Card>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <PieChartIcon className="w-5 h-5 text-pink-600" />
              <h3 className="text-lg font-bold text-gray-900">Merchant Distribution</h3>
            </div>
            <p className="text-sm text-gray-600">Spending by merchant</p>
          </div>
          {merchantData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={merchantData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {merchantData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `$${value.toFixed(2)} (${props.payload.count} transactions)`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              <p>No merchant data available</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

