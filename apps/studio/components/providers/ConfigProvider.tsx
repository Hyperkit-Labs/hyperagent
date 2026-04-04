"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { getConfig } from "@/lib/api";
import { setRuntimeFeatures, setRuntimeConfig } from "@/config/environment";
import { ROUTES } from "@/constants/routes";
import type { RuntimeConfig } from "@/lib/api";

const CONFIG_SWR_KEY = "config";
/** Cache config for 24h. Feature flags and defaults rarely change. */
const CONFIG_STALE_TIME_MS = 24 * 60 * 60 * 1000;

interface ConfigContextValue {
  config: RuntimeConfig | null;
  loading: boolean;
  defaultNetworkId: string | undefined;
  defaultChainId: number | undefined;
}

const ConfigContext = createContext<ConfigContextValue>({
  config: null,
  loading: true,
  defaultNetworkId: undefined,
  defaultChainId: undefined,
});

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext);
}

/**
 * Fetches GET /api/v1/config and provides config via context.
 * Uses SWR: 1 request per session (24h cache), skips fetch on login page.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldFetch = pathname !== ROUTES.LOGIN;

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? CONFIG_SWR_KEY : null,
    getConfig,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      revalidateOnMount: false,
      dedupingInterval: CONFIG_STALE_TIME_MS,
      errorRetryCount: 1,
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    if (pathname === ROUTES.LOGIN) {
      setRuntimeFeatures({ x402: false, monitoring: false });
      setRuntimeConfig({});
      return;
    }
    if (data) {
      setRuntimeFeatures({
        x402: data.x402_enabled,
        monitoring: data.monitoring_enabled ?? false,
      });
      setRuntimeConfig({
        default_network_id: data.default_network_id,
        default_chain_id: data.default_chain_id,
        a2a_agent_id: data.a2a_agent_id,
        a2a_default_chain_id: data.a2a_default_chain_id,
        a2a_identity: data.a2a_identity,
      });
    } else if (error) {
      setRuntimeFeatures({ x402: false, monitoring: false });
      setRuntimeConfig({});
    }
  }, [pathname, data, error]);

  const config = pathname === ROUTES.LOGIN ? null : (data ?? null);
  const loading = pathname === ROUTES.LOGIN ? false : isLoading;

  const value: ConfigContextValue = useMemo(
    () => ({
      config,
      loading,
      defaultNetworkId: config?.default_network_id,
      defaultChainId: config?.default_chain_id,
    }),
    [config, loading],
  );

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}
