/**
 * useMetrics Hook
 * Handles system metrics and analytics data fetching
 * Follows senior frontend best practices for performance monitoring
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getMetrics, getErrorMessage, isAbortError } from "@/lib/api";
import { POLLING } from "@/constants/defaults";

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

/** Shape of /metrics API response for type-safe access */
interface MetricsApiResponse {
  workflows?: {
    total?: number;
    active?: number;
    completed?: number;
    failed?: number;
  };
  contracts?: { total?: number; deployed?: number; verified?: number };
  deployments?: { total?: number; successful?: number; success_rate?: number };
  security?: {
    score?: number;
    open_risks?: {
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
    audit_coverage?: number;
  };
  performance?: {
    avg_latency?: number;
    total_invocations?: number;
    success_rate?: number;
    gas_consumption?: number;
  };
}

export interface UseMetricsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  /** Time range: 7d, 30d, 90d, all. Passed to backend for run counts. */
  timeRange?: "7d" | "30d" | "90d" | "all";
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
    refreshInterval = POLLING.METRICS_MS,
    timeRange = "all",
  } = options;

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  // Fetch metrics from API
  const fetchMetrics = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(null);

        const raw = (await getMetrics(
          { time_range: timeRange },
          signal,
        )) as MetricsApiResponse;

        if (isMounted.current) {
          // Transform API response to expected format
          const metricsData: SystemMetrics = {
            workflows: {
              total: raw.workflows?.total || 0,
              active: raw.workflows?.active || 0,
              completed: raw.workflows?.completed || 0,
              failed: raw.workflows?.failed || 0,
            },
            contracts: {
              total: raw.contracts?.total || 0,
              deployed: raw.contracts?.deployed || 0,
              verified: raw.contracts?.verified || 0,
            },
            deployments: {
              total: raw.deployments?.total || 0,
              successful: raw.deployments?.successful || 0,
              successRate: raw.deployments?.success_rate || 0,
            },
            security: {
              score: raw.security?.score || 0,
              openRisks: {
                critical: raw.security?.open_risks?.critical || 0,
                high: raw.security?.open_risks?.high || 0,
                medium: raw.security?.open_risks?.medium || 0,
                low: raw.security?.open_risks?.low || 0,
              },
              auditCoverage: raw.security?.audit_coverage || 0,
            },
            performance: {
              avgLatency: raw.performance?.avg_latency || 0,
              totalInvocations: raw.performance?.total_invocations || 0,
              successRate: raw.performance?.success_rate || 0,
              gasConsumption: raw.performance?.gas_consumption || 0,
            },
          };

          setMetrics(metricsData);
        }
      } catch (err: unknown) {
        if (isMounted.current && !isAbortError(err)) {
          setError(getErrorMessage(err, "Failed to fetch metrics"));
          // Leave metrics null so UI can show error state instead of fake zeros
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [timeRange],
  );

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
