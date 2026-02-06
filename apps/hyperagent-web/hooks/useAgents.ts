import { useState, useEffect, useCallback } from 'react';
import { getAgents, type AgentStatus, type AgentsResponse } from '@/lib/api';

export interface UseAgentsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
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
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const response: AgentsResponse = await getAgents();
      setAgents(response.agents);
      setTotal(response.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAgents();
  }, [fetchAgents]);

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

