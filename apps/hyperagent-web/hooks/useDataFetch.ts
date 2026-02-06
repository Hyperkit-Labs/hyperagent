'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseDataFetchOptions<T, R> {
  fetcher: (signal?: AbortSignal) => Promise<T>;
  transformer?: (data: T) => R;
  autoRefresh?: boolean;
  refreshInterval?: number;
  filters?: any;
  initialData?: R;
}

export interface UseDataFetchReturn<R> {
  data: R;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isEmpty: boolean;
}

export function useDataFetch<T, R>(
  options: UseDataFetchOptions<T, R>
): UseDataFetchReturn<R> {
  const {
    fetcher,
    transformer,
    autoRefresh = false,
    refreshInterval = 30000,
    initialData,
  } = options;

  const [data, setData] = useState<R>(initialData as R);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setLoading(true);
      
      const result = await fetcher(signal);
      const transformed = transformer ? transformer(result) : (result as unknown as R);
      
      if (isMounted.current) {
        setData(transformed);
      }
    } catch (err: any) {
      if (isMounted.current && err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch data');
        console.error('Error fetching data:', err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetcher, transformer]);

  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    
    fetchController.current = new AbortController();
    await fetchData(fetchController.current.signal);
  }, [fetchData]);

  useEffect(() => {
    isMounted.current = true;
    
    fetchController.current = new AbortController();
    fetchData(fetchController.current.signal);
    
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh && refreshInterval > 0) {
      intervalId = setInterval(() => {
        if (isMounted.current) {
          fetchController.current = new AbortController();
          fetchData(fetchController.current.signal);
        }
      }, refreshInterval);
    }
    
    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [fetchData, autoRefresh, refreshInterval]);

  const isEmpty = Array.isArray(data) ? data.length === 0 : !data;

  return {
    data,
    loading,
    error,
    refetch,
    isEmpty,
  };
}

