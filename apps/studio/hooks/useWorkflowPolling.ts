'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflow, getWorkflowContracts } from '@/lib/api';
import { POLLING } from '@/constants/defaults';
import type { Workflow } from '@/lib/types';

export function useWorkflowPolling(workflowId: string | null) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [contractData, setContractData] = useState<{ bytecode?: string; abi?: unknown; source_code?: string; [key: string]: unknown } | null>(null);
  const [contractCode, setContractCode] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);
  const [lastWorkflowStatus, setLastWorkflowStatus] = useState<string | null>(null);
  const [statusUnchangedCount, setStatusUnchangedCount] = useState(0);

  const fetchWorkflow = useCallback(async () => {
    if (!workflowId || isFetching) return;
    if (pollingStartTime && Date.now() - pollingStartTime > POLLING.WORKFLOW_POLL_TIMEOUT_MS) {
      setAutoRefresh(false);
      return;
    }
    if (lastWorkflowStatus && statusUnchangedCount >= POLLING.WORKFLOW_STATUS_UNCHANGED_LIMIT) {
      setAutoRefresh(false);
      return;
    }
    try {
      setIsFetching(true);
      setError(null);
      const data = await getWorkflow(workflowId);
      setWorkflow(data);

      if (data.status !== lastWorkflowStatus) {
        setLastWorkflowStatus(data.status);
        setStatusUnchangedCount(0);
      } else {
        setStatusUnchangedCount((prev) => prev + 1);
      }

      const shouldFetchContracts =
        !contractData ||
        (data.status === 'completed' && !contractData.bytecode) ||
        (data.status === 'compiling' && lastWorkflowStatus !== 'compiling') ||
        (data.status === 'auditing' && lastWorkflowStatus !== 'auditing') ||
        (data.status === 'testing' && lastWorkflowStatus !== 'testing');

      if (shouldFetchContracts) {
        try {
          const contractsResponse = await getWorkflowContracts(workflowId);
          const contracts = Array.isArray(contractsResponse) ? contractsResponse : (contractsResponse as { contracts?: unknown[] })?.contracts ?? [];
          if (contracts?.length > 0) {
            const contract = contracts[0] as { bytecode?: string; abi?: unknown; source_code?: string; [key: string]: unknown };
            setContractData(contract);
            if (contract.source_code) setContractCode(contract.source_code);
          }
        } catch (contractErr: unknown) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[useWorkflowPolling] Contract fetch failed:', contractErr);
          }
        }
      }

      const terminal = ['failed', 'cancelled', 'completed', 'success'].includes(data.status);
      if (terminal) {
        setAutoRefresh(false);
        setPollingStartTime(null);
        setStatusUnchangedCount(0);
      }

      const inProgress = ['running', 'building', 'generating', 'compiling', 'auditing', 'testing', 'deploying', 'processing', 'spec_review', 'design_review', 'pending'].includes(data.status);
      const pendingSignature = data.meta_data?.deployment_status === 'pending_signature' || data.meta_data?.requires_user_signature;
      if (inProgress || pendingSignature) {
        setAutoRefresh(true);
        if (!pollingStartTime) setPollingStartTime(Date.now());
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load workflow';
      if (!autoRefresh || !msg.includes('Network error')) setError(msg);
    } finally {
      setIsFetching(false);
    }
  }, [
    workflowId,
    isFetching,
    pollingStartTime,
    lastWorkflowStatus,
    statusUnchangedCount,
    contractData,
  ]);

  const fetchWorkflowRef = useRef(fetchWorkflow);
  fetchWorkflowRef.current = fetchWorkflow;

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }
    fetchWorkflow().finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId || !autoRefresh) return;
    const t = setInterval(() => fetchWorkflowRef.current(), POLLING.WORKFLOW_POLL_MS);
    return () => clearInterval(t);
  }, [workflowId, autoRefresh]);

  return {
    workflow,
    loading,
    error,
    autoRefresh,
    setAutoRefresh,
    contractData,
    setContractData,
    contractCode,
    setContractCode,
    fetchWorkflow,
  };
}
