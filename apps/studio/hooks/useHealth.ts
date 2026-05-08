"use client";

import { useState, useEffect, useCallback } from "react";
import { getDetailedHealth, getErrorMessage } from "@/lib/api";
import { POLLING } from "@/constants/defaults";
import type { HealthStatus } from "@/lib/types";

export function useHealth(pollInterval = POLLING.HEALTH_MS) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async (opts?: { isPoll?: boolean }) => {
    if (!opts?.isPoll) setLoading(true);
    try {
      const data = await getDetailedHealth();
      setHealth(data);
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch health status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    void fetchHealth();
    intervalId = setInterval(
      () => void fetchHealth({ isPoll: true }),
      pollInterval,
    );

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollInterval, fetchHealth]);

  return {
    health,
    loading,
    error,
    refetch: () => void fetchHealth(),
  };
}
