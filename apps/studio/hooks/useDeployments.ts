/**
 * useDeployments Hook
 * Handles deployment data fetching with real-time updates and analytics
 * Follows senior frontend best practices
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflows, getErrorMessage, isAbortError } from '@/lib/api';
import { POLLING } from '@/constants/defaults';
import { transformWorkflowToDeployment, type Deployment } from '@/lib/transformers';

export interface DeploymentStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
  avgDuration: number;
  totalGasUsed: number;
}

export interface UseDeploymentsOptions {
  network?: string;
  status?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseDeploymentsReturn {
  deployments: Deployment[];
  stats: DeploymentStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isEmpty: boolean;
}

export function useDeployments(options: UseDeploymentsOptions = {}): UseDeploymentsReturn {
  const {
    network,
    status,
    autoRefresh = true,
    refreshInterval = POLLING.DEPLOYMENTS_MS,
  } = options;

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [stats, setStats] = useState<DeploymentStats>({
    total: 0,
    successful: 0,
    failed: 0,
    pending: 0,
    successRate: 0,
    avgDuration: 0,
    totalGasUsed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);


  // Calculate statistics
  const calculateStats = (deployments: Deployment[]): DeploymentStats => {
    const total = deployments.length;
    const successful = deployments.filter(d => d.status === 'success').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    const pending = deployments.filter(d => d.status === 'pending').length;
    
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    
    const durations = deployments.filter(d => d.duration).map(d => d.duration!);
    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;
    
    const totalGasUsed = deployments
      .filter(d => d.gasUsed)
      .reduce((sum, d) => sum + (d.gasUsed || 0), 0);

    return {
      total,
      successful,
      failed,
      pending,
      successRate: Math.round(successRate * 100) / 100,
      avgDuration: Math.round(avgDuration),
      totalGasUsed,
    };
  };

  // Fetch deployments
  const fetchDeployments = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      
      const data = await getWorkflows({}, signal);
      
      if (isMounted.current) {
        const workflows = data.workflows || [];
        const deploymentsData = workflows.flatMap((w) => {
          const r = transformWorkflowToDeployment(w);
          if (r == null) return [];
          return Array.isArray(r) ? r : [r];
        });
        
        // Apply filters
        const filtered = deploymentsData.filter(d => {
          if (network && d.network !== network) return false;
          if (status && d.status !== status) return false;
          return true;
        });
        
        setDeployments(filtered);
        setStats(calculateStats(filtered));
      }
    } catch (err: unknown) {
      if (isMounted.current && !isAbortError(err)) {
        setError(getErrorMessage(err, 'Failed to fetch deployments'));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [network, status]);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    
    fetchController.current = new AbortController();
    setLoading(true);
    await fetchDeployments(fetchController.current.signal);
  }, [fetchDeployments]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchController.current = new AbortController();
    
    fetchDeployments(fetchController.current.signal);

    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchDeployments]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      if (!loading) {
        refetch();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loading, refetch]);

  return {
    deployments,
    stats,
    loading,
    error,
    refetch,
    isEmpty: deployments.length === 0 && !loading,
  };
}

