/**
 * useNetworks Hook
 * Handles network configuration data fetching from networks.yaml
 * Follows senior frontend best practices
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getNetworks, type NetworkConfig } from '@/lib/api';
import { getServiceUrl } from '@/config/environment';

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
    refreshInterval = 120000, // 2 minutes
  } = options;

  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [networkStats, setNetworkStats] = useState<NetworkStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  // Fetch networks from API (reads from networks.yaml)
  const fetchNetworks = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      
      const data = await getNetworks();
      
      if (isMounted.current) {
        setNetworks(data);
        
        // If stats requested, fetch from metrics API
        if (includeStats) {
          try {
            const metricsResponse = await fetch(`${getServiceUrl('backend')}/api/v1/metrics`);
            if (metricsResponse.ok) {
              const metrics = await metricsResponse.json();
              // Map metrics to network stats if available
              const stats: NetworkStats[] = data.map(network => {
                // Try to get network-specific metrics if available
                const networkMetrics = metrics.networks?.[network.network_id] || {};
                return {
                  chainId: network.chain_id,
                  name: network.name || network.id,
                  requests: networkMetrics.requests || 0,
                  latency: networkMetrics.avg_latency_ms || 0,
                  uptime: networkMetrics.uptime_percentage || 0,
                  status: networkMetrics.status || 'online',
                };
              });
              setNetworkStats(stats);
            } else {
              // Fallback: set default stats
              const stats: NetworkStats[] = data.map(network => ({
                chainId: network.chain_id,
                name: network.name || network.id,
                requests: 0,
                latency: 0,
                uptime: 0,
                status: 'online' as const,
              }));
              setNetworkStats(stats);
            }
          } catch (err) {
            console.error('Failed to fetch network stats:', err);
            // Fallback: set default stats
          const stats: NetworkStats[] = data.map(network => ({
            chainId: network.chain_id,
            name: network.name || network.id,
              requests: 0,
              latency: 0,
              uptime: 0,
            status: 'online' as const,
          }));
          setNetworkStats(stats);
          }
        }
      }
    } catch (err: any) {
      if (isMounted.current && err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch networks');
        console.error('Error fetching networks:', err);
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

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchController.current = new AbortController();
    
    fetchNetworks(fetchController.current.signal);

    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchNetworks]);

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
    networks,
    networkStats,
    loading,
    error,
    refetch,
    getNetworkByChainId,
    getNetworkById,
  };
}

