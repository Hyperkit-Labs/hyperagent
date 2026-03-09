/**
 * useNetworks Hook
 * Fetches network configuration from infra/registries/network/chains.yaml via the backend API (GET /api/v1/networks).
 * Single source of truth for selectable networks; thirdweb is used only for RPC/wallet execution.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNetworks, getMetrics, getErrorMessage, isAbortError, type NetworkConfig } from '@/lib/api';
import { POLLING } from '@/constants/defaults';
import { useNetworksContext } from '@/components/providers/NetworksProvider';

export interface NetworkStats {
  chainId: number;
  name: string;
  requests: number;
  latency: number;
  uptime: number;
  status: 'online' | 'degraded' | 'offline';
}

export interface UseNetworksOptions {
  includeStats?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseNetworksReturn {
  networks: NetworkConfig[];
  networkStats: NetworkStats[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getNetworkByChainId: (chainId: number) => NetworkConfig | undefined;
  getNetworkById: (id: string) => NetworkConfig | undefined;
}

export function useNetworks(options: UseNetworksOptions = {}): UseNetworksReturn {
  const {
    includeStats = false,
    autoRefresh = false,
    refreshInterval = POLLING.NETWORKS_MS,
  } = options;

  const ctx = useNetworksContext();

  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  // Fetch networks from API (backend reads from infra/registries/network/chains.yaml)
  const fetchNetworks = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);

      const [data, metrics] = await Promise.all([
        getNetworks(undefined, signal),
        includeStats ? getMetrics(signal).catch(() => null) : Promise.resolve(null),
      ]);

      if (isMounted.current) {
        setNetworks(data);

        if (includeStats) {
          const stats: NetworkStats[] = metrics && typeof metrics === 'object'
            ? data.map((network: NetworkConfig) => {
                const networksMap = (metrics as { networks?: Record<string, { requests?: number; avg_latency_ms?: number; uptime_percentage?: number; status?: string }> }).networks;
                const networkMetrics = networksMap?.[network.network_id ?? network.id] || {};
                return {
                  chainId: network.chain_id ?? 0,
                  name: network.name || network.id,
                  requests: networkMetrics.requests ?? 0,
                  latency: networkMetrics.avg_latency_ms ?? 0,
                  uptime: networkMetrics.uptime_percentage ?? 0,
                  status: (networkMetrics.status === 'degraded' || networkMetrics.status === 'offline' ? networkMetrics.status : 'online') as NetworkStats['status'],
                };
              })
            : data.map((network: NetworkConfig) => ({
                chainId: network.chain_id ?? 0,
                name: network.name || network.id,
                requests: 0,
                latency: 0,
                uptime: 0,
                status: 'online' as const,
              }));
          setNetworkStats(stats);
        }
      }
    } catch (err: unknown) {
      if (isMounted.current && !isAbortError(err)) {
        setError(getErrorMessage(err, 'Failed to fetch networks'));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [includeStats]);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    
    fetchController.current = new AbortController();
    setLoading(true);
    await fetchNetworks(fetchController.current.signal);
  }, [fetchNetworks]);

  // Helper functions
  const getNetworkByChainId = useCallback((chainId: number) => {
    return networks.find(n => n.chain_id === chainId);
  }, [networks]);

  const getNetworkById = useCallback((id: string) => {
    return networks.find(n => n.id === id);
  }, [networks]);

  // Initial fetch (skip when using shared context)
  useEffect(() => {
    if (ctx && !includeStats) return;
    isMounted.current = true;
    fetchController.current = new AbortController();
    fetchNetworks(fetchController.current.signal);
    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchNetworks, ctx, includeStats]);

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

  if (ctx && !includeStats) {
    return {
      networks: ctx.networks,
      networkStats: [],
      loading: ctx.loading,
      error: ctx.error,
      refetch: ctx.refetch,
      getNetworkByChainId: ctx.getNetworkByChainId,
      getNetworkById: ctx.getNetworkById,
    };
  }

  return {
    networks,
    networkStats,
    loading,
    error,
    refetch,
    getNetworkByChainId,
    getNetworkById,
  };
}

