import React, { useState, useEffect } from 'react';
import { getWorkflows, type WorkflowResponse } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  requests: string;
  percentage: number;
  gradient: string;
  textColor: string;
  barColor: string;
}

const gradients = [
  { gradient: 'from-indigo-500/20 to-purple-500/20', textColor: 'text-indigo-400', barColor: 'bg-indigo-500' },
  { gradient: 'from-emerald-500/20 to-teal-500/20', textColor: 'text-emerald-400', barColor: 'bg-emerald-500' },
  { gradient: 'from-pink-500/20 to-rose-500/20', textColor: 'text-pink-400', barColor: 'bg-pink-500' },
  { gradient: 'from-amber-500/20 to-orange-500/20', textColor: 'text-amber-400', barColor: 'bg-amber-500' },
  { gradient: 'from-blue-500/20 to-cyan-500/20', textColor: 'text-blue-400', barColor: 'bg-blue-500' },
];

export const AnalyticsAgentsTable: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await getWorkflows({ limit: 100 });
        const workflows = response.workflows || [];
        
        // Group workflows by network (acting as "agents")
        const networkCounts: Record<string, number> = {};
        workflows.forEach((wf: WorkflowResponse) => {
          const network = wf.network || 'Unknown';
          networkCounts[network] = (networkCounts[network] || 0) + 1;
        });

        // Sort by count and take top 5
        const sortedNetworks = Object.entries(networkCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        const totalWorkflows = workflows.length;
        const maxCount = sortedNetworks[0]?.[1] || 1;

        const agentsData: Agent[] = sortedNetworks.map(([network, count], index) => {
          const style = gradients[index % gradients.length];
          const initials = network
            .split('-')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return {
            id: initials,
            name: network.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            requests: `${count} workflows`,
            percentage: Math.round((count / maxCount) * 100),
            ...style,
          };
        });

        setAgents(agentsData);
      } catch (error) {
        console.error('Failed to fetch agents data:', error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col animate-fade-in" 
      style={{ animationDelay: '250ms' }}
    >
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Top Performing Networks</h3>
        <button className="text-xs text-slate-500 hover:text-white transition-colors">View All</button>
      </div>
      <div className="divide-y divide-white/5 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-400">No workflow data available</p>
          </div>
        ) : (
          agents.map((agent) => (
            <div key={agent.id} className="px-6 py-3 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
              <div className={`w-8 h-8 rounded bg-gradient-to-br ${agent.gradient} border border-white/5 flex items-center justify-center text-[10px] font-bold ${agent.textColor}`}>
                {agent.id}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                  <span className="text-xs font-mono text-slate-400">{agent.requests}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`${agent.barColor} h-full rounded-full`} style={{ width: `${agent.percentage}%` }}></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};