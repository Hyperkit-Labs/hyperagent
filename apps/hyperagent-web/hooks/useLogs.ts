import { useState, useEffect, useCallback, useRef } from 'react';
import { getLogs, getLogServices, getLogHosts, type LogEntry, type LogsFilters } from '@/lib/api';

export interface UseLogsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  filters?: LogsFilters;
}

export interface UseLogsReturn {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  total: number;
  page: number;
  page_size: number;
  services: string[];
  hosts: string[];
  isEmpty: boolean;
}

export function useLogs(options: UseLogsOptions = {}): UseLogsReturn {
  const {
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    filters = {},
  } = options;

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(filters.page || 1);
  const [page_size, setPageSize] = useState(filters.page_size || 50);
  const [services, setServices] = useState<string[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  
  // Use refs to avoid dependency issues
  const filtersRef = useRef(filters);
  const pageRef = useRef(page);
  const pageSizeRef = useRef(page_size);
  
  // Update refs when values change
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  
  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  
  useEffect(() => {
    pageSizeRef.current = page_size;
  }, [page_size]);

  const fetchLogs = useCallback(async () => {
    try {
      setError(null);
      const response = await getLogs({
        ...filtersRef.current,
        page: pageRef.current,
        page_size: pageSizeRef.current,
      });
      setLogs(response.logs);
      setTotal(response.total);
      setPage(response.page);
      setPageSize(response.page_size);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies - uses refs

  const fetchServices = useCallback(async () => {
    try {
      const servicesList = await getLogServices();
      setServices(servicesList);
    } catch (err) {
      console.error('Error fetching services:', err);
      // Don't throw - just log and continue
    }
  }, []);

  const fetchHosts = useCallback(async () => {
    try {
      const hostsList = await getLogHosts();
      setHosts(hostsList);
    } catch (err) {
      console.error('Error fetching hosts:', err);
      // Don't throw - just log and continue
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchLogs();
    fetchServices();
    fetchHosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Auto-refresh for logs only
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLogs]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
    total,
    page,
    page_size,
    services,
    hosts,
    isEmpty: logs.length === 0 && !loading,
  };
}

