"use client";

import { createContext, useContext, useCallback, useMemo } from "react";
import useSWR from "swr";
import { getNetworks, type NetworkConfig } from "@/lib/api";
import { networkRegistryFailureMessage } from "@/lib/sadPathCopy";

const NETWORKS_SWR_KEY = "networks";
/** Cache networks for 24h. Network list rarely changes; reduces API load by ~90%. */
const NETWORKS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

async function fetcherNetworks(): Promise<NetworkConfig[]> {
  const data = await getNetworks();
  return data;
}

interface NetworksContextValue {
  networks: NetworkConfig[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getNetworkByChainId: (chainId: number) => NetworkConfig | undefined;
  getNetworkById: (id: string) => NetworkConfig | undefined;
}

const NetworksContext = createContext<NetworksContextValue | null>(null);

export function useNetworksContext(): NetworksContextValue | null {
  return useContext(NetworksContext);
}

export function NetworksProvider({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR(
    NETWORKS_SWR_KEY,
    fetcherNetworks,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      revalidateOnMount: false,
      dedupingInterval: NETWORKS_STALE_TIME_MS,
      errorRetryCount: 1,
      keepPreviousData: true,
    },
  );

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const getNetworkByChainId = useCallback(
    (chainId: number) => (data ?? []).find((n) => n.chain_id === chainId),
    [data],
  );

  const getNetworkById = useCallback(
    (id: string) => (data ?? []).find((n) => n.id === id),
    [data],
  );

  const value: NetworksContextValue = useMemo(
    () => ({
      networks: data ?? [],
      loading: isLoading,
      error: error ? networkRegistryFailureMessage(error) : null,
      refetch,
      getNetworkByChainId,
      getNetworkById,
    }),
    [data, isLoading, error, refetch, getNetworkByChainId, getNetworkById],
  );

  return (
    <NetworksContext.Provider value={value}>
      {children}
    </NetworksContext.Provider>
  );
}
