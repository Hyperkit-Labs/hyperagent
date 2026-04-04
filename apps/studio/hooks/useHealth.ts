"use client";

import { useState, useEffect } from "react";
import { getDetailedHealth, getErrorMessage } from "@/lib/api";
import { POLLING } from "@/constants/defaults";
import type { HealthStatus } from "@/lib/types";

export function useHealth(pollInterval = POLLING.HEALTH_MS) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchHealth = async () => {
      try {
        const data = await getDetailedHealth();
        if (isMounted) {
          setHealth(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(getErrorMessage(err, "Failed to fetch health status"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHealth();
    intervalId = setInterval(fetchHealth, pollInterval);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [pollInterval]);

  return { health, loading, error };
}
