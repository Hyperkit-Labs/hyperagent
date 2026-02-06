import React, { useState, useEffect } from 'react';
import Activity from 'lucide-react/dist/esm/icons/activity'
import Timer from 'lucide-react/dist/esm/icons/timer'
import Layers from 'lucide-react/dist/esm/icons/layers'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import { getMetrics } from '@/lib/api';

export const DeploymentsStats: React.FC = () => {
  const [successRate, setSuccessRate] = useState('0%');
  const [avgDuration, setAvgDuration] = useState('0s');
  const [totalDeploys, setTotalDeploys] = useState(0);
  const [networkCount, setNetworkCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const metrics = await getMetrics();
        
        if (metrics && metrics.workflows) {
          const total = metrics.workflows.total || 0;
          const completed = metrics.workflows.completed || 0;
          const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
          setSuccessRate(`${rate}%`);
        }

        if (metrics && metrics.performance && metrics.performance.avg_deployment_time) {
          const avgTime = Math.round(metrics.performance.avg_deployment_time);
          setAvgDuration(`${avgTime}s`);
        }

        if (metrics && metrics.deployments) {
          setTotalDeploys(metrics.deployments.total || 0);
          const networks = Object.keys(metrics.deployments.by_network || {});
          setNetworkCount(networks.length);
        }
      } catch (error) {
        console.error('Failed to fetch deployment stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/2 mb-2" />
            <div className="h-8 bg-slate-800 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Success Rate
          </span>
          <Activity className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">{successRate}</div>
        <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
          <ArrowUp className="w-3 h-3" /> Real-time
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Avg Duration
          </span>
          <Timer className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">{avgDuration}</div>
        <div className="text-[10px] text-slate-500 mt-1">Per deployment</div>
      </div>

      <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Total Deploys
          </span>
          <Layers className="w-4 h-4 text-slate-500" />
        </div>
        <div className="text-2xl font-semibold text-white tracking-tight">
          {totalDeploys.toLocaleString()}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          Across {networkCount} {networkCount === 1 ? 'network' : 'networks'}
        </div>
      </div>
    </div>
  );
};