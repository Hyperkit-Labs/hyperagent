'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getConfig } from '@/lib/api';
import { setRuntimeFeatures, setRuntimeConfig } from '@/config/environment';
import { ROUTES } from '@/constants/routes';
import type { RuntimeConfig } from '@/lib/api';

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
 * Updates runtime feature flags and config for non-React consumers.
 */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (pathname === ROUTES.LOGIN) {
      setRuntimeFeatures({ x402: false, monitoring: false });
      setRuntimeConfig({});
      setConfig(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getConfig();
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
      setConfig(data);
    } catch {
      setRuntimeFeatures({ x402: false, monitoring: false });
      setRuntimeConfig({});
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const value: ConfigContextValue = {
    config,
    loading,
    defaultNetworkId: config?.default_network_id,
    defaultChainId: config?.default_chain_id,
  };

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
