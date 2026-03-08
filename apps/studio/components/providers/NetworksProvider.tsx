"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { getNetworks, getErrorMessage, isAbortError, type NetworkConfig } from "@/lib/api";

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
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  const fetchNetworks = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const data = await getNetworks(undefined, signal);
      setNetworks(data);
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        setError(getErrorMessage(err, "Failed to fetch networks"));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    fetchController.current = new AbortController();
    setLoading(true);
    await fetchNetworks(fetchController.current.signal);
  }, [fetchNetworks]);

  const getNetworkByChainId = useCallback(
    (chainId: number) => networks.find((n) => n.chain_id === chainId),
    [networks]
  );

  const getNetworkById = useCallback(
    (id: string) => networks.find((n) => n.id === id),
    [networks]
  );

  useEffect(() => {
    fetchController.current = new AbortController();
    fetchNetworks(fetchController.current.signal);
    return () => {
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchNetworks]);

  const value: NetworksContextValue = {
    networks,
    loading,
    error,
    refetch,
    getNetworkByChainId,
    getNetworkById,
  };

  return (
    <NetworksContext.Provider value={value}>{children}</NetworksContext.Provider>
  );
}
