import { useState, useEffect, useCallback } from 'react';
import { getAgents, getErrorMessage, type AgentStatus, type AgentsResponse } from '@/lib/api';
import { POLLING } from '@/constants/defaults';

export interface UseAgentsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  refreshTrigger?: number;
}

export interface UseAgentsReturn {
  agents: AgentStatus[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  total: number;
  isEmpty: boolean;
}

export function useAgents(options: UseAgentsOptions = {}): UseAgentsReturn {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    refreshTrigger = 0,
  } = options;

  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const response: AgentsResponse = await getAgents();
      const list = response.agents ?? [];
      setAgents(list);
      setTotal(typeof (response as { total?: number }).total === "number" ? (response as { total: number }).total : list.length);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch agents'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAgents();
  }, [fetchAgents, refreshTrigger]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAgents();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchAgents]);

  return {
    agents,
    loading,
    error,
    refetch: fetchAgents,
    total,
    isEmpty: agents.length === 0 && !loading,
  };
}

