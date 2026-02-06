/**
 * useContracts Hook
 * Handles smart contracts data fetching with filtering and real-time updates
 * Follows senior frontend best practices for data management
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflows, type WorkflowResponse } from '@/lib/api';
import { transformWorkflowToContract, type Contract } from '@/lib/transformers';

export interface UseContractsOptions {
  network?: string;
  verified?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseContractsReturn {
  contracts: Contract[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isEmpty: boolean;
  filteredContracts: Contract[];
}

export function useContracts(options: UseContractsOptions = {}): UseContractsReturn {
  const {
    network,
    verified,
    autoRefresh = true,
    refreshInterval = 60000, // 60 seconds
  } = options;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMounted = useRef(true);
  const fetchController = useRef<AbortController | null>(null);


  // Fetch contracts from API
  const fetchContracts = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      
      // Fetch all workflows and filter those with deployments
      const data = await getWorkflows({}, signal);
      
      if (isMounted.current) {
        const workflows = data.workflows || [];
        const contractsData = workflows
          .map(transformWorkflowToContract)
          .filter((c): c is Contract => c !== null);
        setContracts(contractsData);
      }
    } catch (err: any) {
      if (isMounted.current && err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch contracts');
        console.error('Error fetching contracts:', err);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Manual refetch
  const refetch = useCallback(async () => {
    if (fetchController.current) {
      fetchController.current.abort();
    }
    
    fetchController.current = new AbortController();
    setLoading(true);
    await fetchContracts(fetchController.current.signal);
  }, [fetchContracts]);

  // Apply filters
  const filteredContracts = contracts.filter(contract => {
    if (network && contract.network !== network) return false;
    if (verified !== undefined && contract.verified !== verified) return false;
    return true;
  });

  // Initial fetch
  useEffect(() => {
    isMounted.current = true;
    fetchController.current = new AbortController();
    
    fetchContracts(fetchController.current.signal);

    return () => {
      isMounted.current = false;
      if (fetchController.current) {
        fetchController.current.abort();
      }
    };
  }, [fetchContracts]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      if (!loading) {
        refetch();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loading, refetch]);

  return {
    contracts,
    loading,
    error,
    refetch,
    isEmpty: filteredContracts.length === 0 && !loading,
    filteredContracts,
  };
}

