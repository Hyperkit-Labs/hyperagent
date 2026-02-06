import React from 'react';
import { AgentTableHeader } from '@/components/pages/agents/table-header';
import { AgentTableRow } from '@/components/pages/agents/table-row';
import { AgentTableFooter } from '@/components/pages/agents/table-footer';
import { useAgents } from '@/hooks/useAgents';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export interface Agent {
  id: string;
  name: string;
  agentId: string;
  badge: {
    label: string;
    color: string;
  };
  icon: string;
  iconGradient: string;
  model: string;
  contextUsed: number;
  contextTotal: number;
  status: 'thinking' | 'active' | 'idle' | 'offline';
  activity: {
    message: string;
    detail?: string;
  };
  enabled: boolean;
  isDisabled?: boolean;
}

// Transform backend agent to frontend format
function transformAgent(backendAgent: any): Agent {
  return {
    id: backendAgent.id,
    name: backendAgent.name,
    agentId: backendAgent.agent_id,
    badge: backendAgent.badge,
    icon: backendAgent.icon,
    iconGradient: backendAgent.icon_gradient,
    model: backendAgent.model,
    contextUsed: backendAgent.context_used,
    contextTotal: backendAgent.context_total,
    status: backendAgent.status,
    activity: backendAgent.activity,
    enabled: backendAgent.enabled,
    isDisabled: backendAgent.is_disabled || false,
  };
}

export const AgentsTable: React.FC = () => {
  const { agents, loading, error, refetch, total } = useAgents({
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const transformedAgents = agents.map(transformAgent);

  if (loading && transformedAgents.length === 0) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        <AgentTableHeader />
        <div className="flex-1 flex items-center justify-center">
          <LoadingState message="Loading agents..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        <AgentTableHeader />
        <div className="p-4">
          <ErrorAlert message={error} severity="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
      <AgentTableHeader />

      {loading && transformedAgents.length > 0 && (
        <div className="p-3 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2 text-sm text-violet-400">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Refreshing agents...</span>
        </div>
      )}

      {/* List Items */}
      <div className="divide-y divide-white/5">
        {transformedAgents.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">No agents found</p>
          </div>
        ) : (
          transformedAgents.map((agent) => (
          <AgentTableRow key={agent.id} agent={agent} />
          ))
        )}
      </div>

      <AgentTableFooter totalAgents={total} />
    </div>
  );
};