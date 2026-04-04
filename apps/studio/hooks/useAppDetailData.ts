/**
 * useAppDetailData
 *
 * Single batched fetch for app detail page. Replaces three parallel/sequential calls
 * (getWorkflow, getWorkflowContracts, getWorkflowDeployments) with one Promise.all.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getWorkflow,
  getWorkflowContracts,
  getWorkflowDeployments,
} from "@/lib/api";
import type { Workflow } from "@/lib/types";

export type ContractItem = {
  bytecode?: string;
  abi?: unknown;
  contract_name?: string;
  [key: string]: unknown;
};
export type DeploymentItem = {
  contract_address?: string;
  network?: string;
  [key: string]: unknown;
};

export interface UseAppDetailDataOptions {
  workflowId: string | undefined;
  enabled?: boolean;
}

export interface UseAppDetailDataReturn {
  workflow: Workflow | null;
  contracts: ContractItem[];
  deployments: DeploymentItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useAppDetailData(
  options: UseAppDetailDataOptions,
): UseAppDetailDataReturn {
  const { workflowId, enabled = true } = options;
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled || !workflowId) {
      setWorkflow(null);
      setContracts([]);
      setDeployments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [wf, cList, dRes] = await Promise.all([
        getWorkflow(workflowId),
        getWorkflowContracts(workflowId).catch(() => []),
        getWorkflowDeployments(workflowId).catch(() => ({ deployments: [] })),
      ]);
      setWorkflow(wf);
      setContracts(Array.isArray(cList) ? cList : []);
      const dList =
        (dRes as { deployments?: DeploymentItem[] })?.deployments ?? [];
      setDeployments(Array.isArray(dList) ? dList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app");
      setWorkflow(null);
      setContracts([]);
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, workflowId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    workflow,
    contracts,
    deployments,
    loading,
    error,
    refetch: fetchAll,
  };
}
