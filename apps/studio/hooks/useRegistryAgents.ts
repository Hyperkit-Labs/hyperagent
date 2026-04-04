"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listRegistryAgents,
  type RegistryAgentRow,
} from "@/lib/api/agentRegistry";
import { getErrorMessage } from "@/lib/api";

export function useRegistryAgents(limit = 100) {
  const [agents, setAgents] = useState<RegistryAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await listRegistryAgents({ limit });
      setAgents(r.agents ?? []);
    } catch (e) {
      setError(getErrorMessage(e, "Could not load registry index"));
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { agents, loading, error, refetch };
}
