"use client";

import React, { useEffect, useState } from 'react';
import Activity from 'lucide-react/dist/esm/icons/activity'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Box from 'lucide-react/dist/esm/icons/box'
import Server from 'lucide-react/dist/esm/icons/server'
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { getMetrics, getWorkflows } from '@/lib/api';

interface MetricsData {
  activeWorkflows: number;
  successfulAudits: number;
  totalDeployments: number;
  networksOnline: number;
  totalNetworks: number;
}

export const KPIGrid: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData>({
    activeWorkflows: 0,
    successfulAudits: 0,
    totalDeployments: 0,
    networksOnline: 0,
    totalNetworks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [metricsData, workflowsData] = await Promise.all([
          getMetrics(),
          getWorkflows({ status: 'in_progress' }),
        ]);

        setMetrics({
          activeWorkflows: workflowsData.total || 0,
          successfulAudits: metricsData.workflows?.completed || 0,
          totalDeployments: metricsData.deployments?.total || 0,
          networksOnline: Object.keys(metricsData.deployments?.by_network || {}).length || 0,
          totalNetworks: 10, // Total supported networks
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1 */}
      <div className="relative group bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:border-violet-500/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
            <Activity className="w-5 h-5 text-violet-400" />
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            Live <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
        <div className="text-3xl font-medium tracking-tight text-white mb-1">{metrics.activeWorkflows}</div>
        <div className="text-xs text-slate-400 font-medium">Active Workflows</div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-violet-600/0 via-violet-600/50 to-violet-600/0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* KPI 2 */}
      <div className="relative group bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:border-violet-500/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            Total
          </span>
        </div>
        <div className="text-3xl font-medium tracking-tight text-white mb-1">{metrics.successfulAudits}</div>
        <div className="text-xs text-slate-400 font-medium">Completed Workflows</div>
      </div>

      {/* KPI 3 */}
      <div className="relative group bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:border-violet-500/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <Box className="w-5 h-5 text-orange-400" />
          </div>
          <span className="text-xs text-slate-500">Total</span>
        </div>
        <div className="text-3xl font-medium tracking-tight text-white mb-1">{metrics.totalDeployments}</div>
        <div className="text-xs text-slate-400 font-medium">Contracts Deployed</div>
      </div>

      {/* KPI 4 */}
      <div className="relative group bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl p-5 hover:border-violet-500/30 transition-all duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Server className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-xs font-medium text-slate-400">{metrics.totalNetworks} Total</span>
        </div>
        <div className="text-3xl font-medium tracking-tight text-white mb-1">{metrics.networksOnline}/{metrics.totalNetworks}</div>
        <div className="text-xs text-slate-400 font-medium">Networks Active</div>
      </div>
    </div>
  );
};