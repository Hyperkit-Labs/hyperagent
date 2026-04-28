/**
 * useDashboardData
 *
 * Single consolidated fetch for Dashboard page. Replaces three parallel hooks
 * (useMetrics, useWorkflows, useDeployments) with one batched request.
 * Reduces API calls from 3 to 2 (metrics + workflows; deployments derived from workflows).
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getMetrics, getWorkflows, getErrorMessage } from "@/lib/api";
import { transformWorkflowToDeployment } from "@/lib/transformers";
import type { Workflow } from "@/lib/types";
import type { Deployment } from "@/lib/transformers";
import type { SystemMetrics } from "./useMetrics";

interface WorkflowApiResponse {
  workflows?: Workflow[];
  total?: number;
}

export interface UseDashboardDataReturn {
  metrics: SystemMetrics | null;
  workflows: Workflow[];
  workflowsTotal: number;
  deployments: Deployment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_METRICS: SystemMetrics = {
  workflows: { total: 0, active: 0, completed: 0, failed: 0 },
  contracts: { total: 0, deployed: 0, verified: 0 },
  deployments: { total: 0, successful: 0, successRate: 0 },
  security: {
    score: 0,
    openRisks: { critical: 0, high: 0, medium: 0, low: 0 },
    auditCoverage: 0,
  },
  performance: {
    avgLatency: 0,
    totalInvocations: 0,
    successRate: 0,
  },
};

function normalizeMetrics(raw: unknown): SystemMetrics {
  if (!raw || typeof raw !== "object") return DEFAULT_METRICS;
  const m = raw as Record<string, unknown>;
  const w = (m.workflows as Record<string, number>) ?? {};
  const c = (m.contracts as Record<string, number>) ?? {};
  const d = (m.deployments as Record<string, number>) ?? {};
  return {
    workflows: {
      total: Number(w.total) ?? 0,
      active: Number(w.active) ?? 0,
      completed: Number(w.completed) ?? 0,
      failed: Number(w.failed) ?? 0,
    },
    contracts: {
      total: Number(c.total) ?? 0,
      deployed: Number(c.deployed) ?? 0,
      verified: Number(c.verified) ?? 0,
    },
    deployments: {
      total: Number(d.total) ?? 0,
      successful: Number(d.successful ?? d.success_rate) ?? 0,
      successRate: Number(d.success_rate) ?? 0,
    },
    security: DEFAULT_METRICS.security,
    performance: DEFAULT_METRICS.performance,
  };
}

function workflowsToDeployments(workflows: Workflow[]): Deployment[] {
  return workflows.flatMap((w) => {
    const r = transformWorkflowToDeployment(w);
    if (r == null) return [];
    return Array.isArray(r) ? r : [r];
  });
}

export function useDashboardData(options?: {
  workflowsLimit?: number;
}): UseDashboardDataReturn {
  const limit = options?.workflowsLimit ?? 10;
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowsTotal, setWorkflowsTotal] = useState(0);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, workflowsRes] = await Promise.all([
        getMetrics(),
        getWorkflows({ limit }),
      ]);
      const wData = workflowsRes as WorkflowApiResponse;
      const list = Array.isArray(workflowsRes)
        ? workflowsRes
        : (wData?.workflows ?? []);
      const total =
        typeof (workflowsRes as unknown as { total?: number }).total ===
        "number"
          ? (workflowsRes as unknown as { total: number }).total
          : list.length;
      setMetrics(normalizeMetrics(metricsRes));
      setWorkflows(list);
      setWorkflowsTotal(total);
      setDeployments(workflowsToDeployments(list));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    metrics,
    workflows,
    workflowsTotal,
    deployments,
    loading,
    error,
    refetch: fetchAll,
  };
}
