'use client';

import { useState, useEffect } from 'react';
import { getDetailedHealth } from '@/lib/api';
import type { HealthStatus } from '@/lib/types';

export function useHealth(pollInterval = 30000) {
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
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch health status');
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

