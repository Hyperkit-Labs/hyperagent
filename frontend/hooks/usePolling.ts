'use client';

import { useEffect, useRef } from 'react';

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number,
  condition: (data: T) => boolean = () => true
) {
  const dataRef = useRef<T | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await fetchFn();
        dataRef.current = data;
        
        if (!condition(data)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchFn, interval, condition]);

  return dataRef.current;
}

