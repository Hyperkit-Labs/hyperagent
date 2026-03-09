'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getErrorMessage, isAbortError } from '@/lib/api';
import { POLLING } from '@/constants/defaults';

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
    refreshInterval = POLLING.DATA_FETCH_MS,
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
    } catch (err: unknown) {
      if (isMounted.current && !isAbortError(err)) {
        setError(getErrorMessage(err, 'Failed to fetch data'));
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
    
    const controller = new AbortController();
    fetchController.current = controller;
    fetchData(controller.signal);
    
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh && refreshInterval > 0) {
      intervalId = setInterval(() => {
        if (isMounted.current) {
          const newController = new AbortController();
          fetchController.current = newController;
          fetchData(newController.signal);
        }
      }, refreshInterval);
    }
    
    return () => {
      isMounted.current = false;
      controller.abort();
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

