'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWorkflow, getWorkflowContracts } from '@/lib/api';
import { POLLING } from '@/constants/defaults';
import type { Workflow } from '@/lib/types';

type ContractItem = { bytecode?: string; abi?: unknown; source_code?: string; [key: string]: unknown };

export function useWorkflowPolling(workflowId: string | null) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [contractData, setContractData] = useState<ContractItem | null>(null);
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
      const shouldFetchContracts =
        !contractData ||
        lastWorkflowStatus === null ||
        ['compiling', 'auditing', 'testing', 'completed', 'success'].includes(lastWorkflowStatus ?? '');

      const [data, contractsResponse] = await Promise.all([
        getWorkflow(workflowId),
        shouldFetchContracts ? getWorkflowContracts(workflowId).catch(() => []) : Promise.resolve(null),
      ]);

      setWorkflow(data);

      if (data.status !== lastWorkflowStatus) {
        setLastWorkflowStatus(data.status);
        setStatusUnchangedCount(0);
      } else {
        setStatusUnchangedCount((prev) => prev + 1);
      }

      if (contractsResponse !== null) {
        const contractsList = Array.isArray(contractsResponse) ? contractsResponse : (contractsResponse as { contracts?: unknown[] })?.contracts ?? [];
        if (contractsList.length > 0) {
          setContracts(contractsList as ContractItem[]);
          const first = contractsList[0] as ContractItem;
          setContractData(first);
          setContractCode(first.source_code ?? null);
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
      setWorkflow(null);
      setContracts([]);
      setContractData(null);
      setContractCode(null);
      setLastWorkflowStatus(null);
      setStatusUnchangedCount(0);
      setPollingStartTime(null);
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
    contracts,
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
