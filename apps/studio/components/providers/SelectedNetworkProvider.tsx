"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useConfig } from "@/components/providers/ConfigProvider";
import { useNetworks } from "@/hooks/useNetworks";
import {
  FALLBACK_DEFAULT_NETWORK_ID,
  getDefaultNetworkIdFromList,
} from "@/constants/defaults";

const STORAGE_KEY = "hyperkit_selected_network_id";

function getStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStored(id: string | null): void {
  try {
    if (id == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

interface SelectedNetworkContextValue {
  selectedNetworkId: string;
  setSelectedNetworkId: (id: string) => void;
}

const SelectedNetworkContext =
  createContext<SelectedNetworkContextValue | null>(null);

export function useSelectedNetwork(): SelectedNetworkContextValue {
  const ctx = useContext(SelectedNetworkContext);
  if (!ctx) {
    throw new Error(
      "useSelectedNetwork must be used within SelectedNetworkProvider",
    );
  }
  return ctx;
}

export function SelectedNetworkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { defaultNetworkId: configDefault } = useConfig();
  const { networks } = useNetworks();
  const [selectedNetworkId, setSelectedNetworkIdState] = useState<string>(
    FALLBACK_DEFAULT_NETWORK_ID,
  );
  const initialisedRef = useRef(false);

  const resolveInitial = useCallback((): string => {
    const stored = getStored();
    if (stored) {
      const found = networks.find(
        (n) => n.id === stored || n.network_id === stored,
      );
      if (found) return found.id;
    }
    if (configDefault) {
      const found = networks.find(
        (n) => n.id === configDefault || n.network_id === configDefault,
      );
      if (found) return found.id;
    }
    return getDefaultNetworkIdFromList(
      (networks ?? []).map((n) => ({
        id: n.id ?? n.network_id ?? "",
        is_mainnet: n.is_mainnet,
      })),
    );
  }, [networks, configDefault]);

  useEffect(() => {
    if (networks.length === 0) return;
    const resolved = resolveInitial();
    if (!initialisedRef.current) {
      setSelectedNetworkIdState(resolved);
      setStored(resolved);
      initialisedRef.current = true;
    }
  }, [networks, resolveInitial]);

  const setSelectedNetworkId = useCallback((id: string) => {
    setSelectedNetworkIdState(id);
    setStored(id);
  }, []);

  const value: SelectedNetworkContextValue = {
    selectedNetworkId,
    setSelectedNetworkId,
  };

  return (
    <SelectedNetworkContext.Provider value={value}>
      {children}
    </SelectedNetworkContext.Provider>
  );
}
