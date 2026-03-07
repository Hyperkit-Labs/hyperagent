/**
 * useWorkflows Hook
 * Handles workflows data fetching with real-time updates, caching, and error handling
 * Follows senior frontend best practices for state management and data fetching
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflows, getErrorMessage, isAbortError } from '@/lib/api';
import { POLLING } from '@/constants/defaults';
import type { Workflow } from '@/lib/types';

export interface UseWorkflowsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  filters?: {
    status?: string;
    network?: string;
    limit?: number;
  };
}

export interface UseWorkflowsReturn {
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isEmpty: boolean;
  total: number;
}

export function useWorkflows(options: UseWorkflowsOptions = {}): UseWorkflowsReturn {
  const {
    autoRefresh = true,
    refreshInterval = POLLING.WORKFLOWS_MS,
    filters = {},
  } = options;

  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  // Fetch workflows from API
  const fetchWorkflows = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      
      const data = await getWorkflows({
        status: filters.status,
        limit: filters.limit,
      }, signal);

      if (isMounted.current) {
        const list = Array.isArray(data) ? data : (data?.workflows ?? []);
        const totalFromApi = (data as unknown as { total?: number }).total;
        const count = typeof totalFromApi === 'number' ? totalFromApi : list.length;
        setWorkflows(list);
        setTotal(count);
      }
    } catch (err: unknown) {
      if (isMounted.current && !isAbortError(err)) {
        setError(getErrorMessage(err, 'Failed to fetch workflows'));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [filters.status, filters.limit]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    // Cancel any in-flight requests
    if (fetchController.current) {
      fetchController.current.abort();
    }

    fetchController.current = new AbortController();
    setLoading(true);
    await fetchWorkflows(fetchController.current.signal);
  }, [fetchWorkflows]);

  // Note: Global workflows WebSocket endpoint not available in backend.
  // Backend only supports per-workflow WebSocket: /ws/workflows/{workflow_id}
  // For real-time updates to the workflows list, we rely on polling below.

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchController.current = new AbortController();
    
    fetchWorkflows(fetchController.current.signal);

    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchWorkflows]);

  // Auto-refresh polling (fallback if WebSocket fails)
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      if (!loading) {
        refetch();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loading, refetch]);

  const list = Array.isArray(workflows) ? workflows : [];
  return {
    workflows: list,
    loading,
    error,
    refetch,
    isEmpty: list.length === 0 && !loading,
    total,
  };
}

