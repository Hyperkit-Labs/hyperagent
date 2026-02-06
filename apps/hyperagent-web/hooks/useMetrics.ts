/**
 * useMetrics Hook
 * Handles system metrics and analytics data fetching
 * Follows senior frontend best practices for performance monitoring
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMetrics } from '@/lib/api';

export interface SystemMetrics {
  workflows: {
    total: number;
    active: number;
    completed: number;
    failed: number;
  };
  contracts: {
    total: number;
    deployed: number;
    verified: number;
  };
  deployments: {
    total: number;
    successful: number;
    successRate: number;
  };
  security: {
    score: number;
    openRisks: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    auditCoverage: number;
  };
  performance: {
    avgLatency: number;
    totalInvocations: number;
    successRate: number;
    gasConsumption: number;
  };
}

export interface UseMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseMetricsReturn {
  metrics: SystemMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_METRICS: SystemMetrics = {
  workflows: {
    total: 0,
    active: 0,
    completed: 0,
    failed: 0,
  },
  contracts: {
    total: 0,
    deployed: 0,
    verified: 0,
  },
  deployments: {
    total: 0,
    successful: 0,
    successRate: 0,
  },
  security: {
    score: 0,
    openRisks: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    auditCoverage: 0,
  },
  performance: {
    avgLatency: 0,
    totalInvocations: 0,
    successRate: 0,
    gasConsumption: 0,
  },
};

export function useMetrics(options: UseMetricsOptions = {}): UseMetricsReturn {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options;

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  // Fetch metrics from API
  const fetchMetrics = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      
      const data = await getMetrics(signal);
      
      if (isMounted.current) {
        // Transform API response to expected format
        const metricsData: SystemMetrics = {
          workflows: {
            total: data.workflows?.total || 0,
            active: data.workflows?.active || 0,
            completed: data.workflows?.completed || 0,
            failed: data.workflows?.failed || 0,
          },
          contracts: {
            total: data.contracts?.total || 0,
            deployed: data.contracts?.deployed || 0,
            verified: data.contracts?.verified || 0,
          },
          deployments: {
            total: data.deployments?.total || 0,
            successful: data.deployments?.successful || 0,
            successRate: data.deployments?.success_rate || 0,
          },
          security: {
            score: data.security?.score || 0,
            openRisks: {
              critical: data.security?.open_risks?.critical || 0,
              high: data.security?.open_risks?.high || 0,
              medium: data.security?.open_risks?.medium || 0,
              low: data.security?.open_risks?.low || 0,
            },
            auditCoverage: data.security?.audit_coverage || 0,
          },
          performance: {
            avgLatency: data.performance?.avg_latency || 0,
            totalInvocations: data.performance?.total_invocations || 0,
            successRate: data.performance?.success_rate || 0,
            gasConsumption: data.performance?.gas_consumption || 0,
          },
        };
        
        setMetrics(metricsData);
      }
    } catch (err: any) {
      if (isMounted.current && err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch metrics');
        console.error('Error fetching metrics:', err);
        // Set default metrics on error
        setMetrics(DEFAULT_METRICS);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    
    fetchController.current = new AbortController();
    setLoading(true);
    await fetchMetrics(fetchController.current.signal);
  }, [fetchMetrics]);

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchController.current = new AbortController();
    
    fetchMetrics(fetchController.current.signal);

    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchMetrics]);

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
    metrics,
    loading,
    error,
    refetch,
  };
}

