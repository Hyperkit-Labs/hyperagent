import React, { useState, useEffect } from 'react';
import Zap from 'lucide-react/dist/esm/icons/zap'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Fuel from 'lucide-react/dist/esm/icons/fuel'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import { getMetrics } from '@/lib/api';

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  value: string;
  unit?: string;
  trend: {
    value: string;
    direction: 'up' | 'down';
    positive: boolean;
    label: string;
  };
  delay: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, icon, value, unit, trend, delay }) => {
  return (
    <div 
      className="p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md hover:border-white/10 transition-colors animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white tracking-tight">{value}</span>
        {unit && <span className="text-sm text-slate-500 font-normal">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className={`${trend.positive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'} px-1.5 py-0.5 rounded flex items-center gap-1`}>
          {trend.direction === 'up' ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
          {trend.value}
        </span>
        <span className="text-slate-500">{trend.label}</span>
      </div>
    </div>
  );
};

export const AnalyticsStats: React.FC = () => {
  const [stats, setStats] = useState<StatCardProps[]>([
    {
      title: 'Total Invocations',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      value: '0',
      trend: { value: '0%', direction: 'up', positive: true, label: 'Loading...' },
      delay: 0
    },
    {
      title: 'Avg. Latency',
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      value: '0',
      unit: 'ms',
      trend: { value: '0%', direction: 'down', positive: true, label: 'Loading...' },
      delay: 50
    },
    {
      title: 'Success Rate',
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      value: '0',
      unit: '%',
      trend: { value: '0%', direction: 'up', positive: true, label: 'Loading...' },
      delay: 100
    },
    {
      title: 'Gas Consumption',
      icon: <Fuel className="w-4 h-4 text-purple-400" />,
      value: '0',
      unit: 'ETH',
      trend: { value: '0%', direction: 'up', positive: false, label: 'Loading...' },
      delay: 150
    }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const metrics = await getMetrics();
        
        const totalInvocations = metrics?.workflows?.total || 0;
        const completedWorkflows = metrics?.workflows?.completed || 0;
        const failedWorkflows = metrics?.workflows?.failed || 0;
        
        // Calculate success rate
        const successRate = totalInvocations > 0 
          ? ((completedWorkflows / totalInvocations) * 100).toFixed(2)
          : '0.00';
        
        // Get average latency (generation + compilation + deployment)
        const avgGenTime = metrics?.performance?.avg_generation_time || 0;
        const avgCompileTime = metrics?.performance?.avg_compilation_time || 0;
        const avgDeployTime = metrics?.performance?.avg_deployment_time || 0;
        const totalAvgTime = Math.round(avgGenTime + avgCompileTime + avgDeployTime);
        
        // Estimated gas consumption (mock for now, would need actual on-chain data)
        const estimatedGas = (totalInvocations * 0.002).toFixed(2);

        setStats([
          {
            title: 'Total Invocations',
            icon: <Zap className="w-4 h-4 text-amber-400" />,
            value: totalInvocations.toLocaleString(),
            trend: {
              value: 'Real-time',
              direction: 'up',
              positive: true,
              label: 'All workflows'
            },
            delay: 0
          },
          {
            title: 'Avg. Latency',
            icon: <Clock className="w-4 h-4 text-blue-400" />,
            value: totalAvgTime > 0 ? totalAvgTime.toString() : '0',
            unit: 's',
            trend: {
              value: totalAvgTime < 60 ? 'Fast' : 'Normal',
              direction: totalAvgTime < 60 ? 'down' : 'up',
              positive: totalAvgTime < 60,
              label: 'Workflow execution'
            },
            delay: 50
          },
          {
            title: 'Success Rate',
            icon: <Activity className="w-4 h-4 text-emerald-400" />,
            value: successRate,
            unit: '%',
            trend: {
              value: `${failedWorkflows} Failed`,
              direction: failedWorkflows === 0 ? 'up' : 'down',
              positive: parseFloat(successRate) >= 95,
              label: `${completedWorkflows} completed`
            },
            delay: 100
          },
          {
            title: 'Gas Consumption',
            icon: <Fuel className="w-4 h-4 text-purple-400" />,
            value: estimatedGas,
            unit: 'ETH',
            trend: {
              value: 'Estimate',
              direction: 'up',
              positive: false,
              label: 'Multi-chain total'
            },
            delay: 150
          }
        ]);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/2 mb-4" />
            <div className="h-8 bg-slate-800 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};