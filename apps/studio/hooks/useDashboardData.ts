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
import {
  CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
  withAsyncTimeout,
} from "@/lib/runtime-timeouts";
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

function coerceMetricValue(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeMetrics(raw: unknown): SystemMetrics {
  if (!raw || typeof raw !== "object") return DEFAULT_METRICS;
  const m = raw as Record<string, unknown>;
  const w = (m.workflows as Record<string, number>) ?? {};
  const c = (m.contracts as Record<string, number>) ?? {};
  const d = (m.deployments as Record<string, number>) ?? {};
  return {
    workflows: {
      total: coerceMetricValue(w.total),
      active: coerceMetricValue(w.active),
      completed: coerceMetricValue(w.completed),
      failed: coerceMetricValue(w.failed),
    },
    contracts: {
      total: coerceMetricValue(c.total),
      deployed: coerceMetricValue(c.deployed),
      verified: coerceMetricValue(c.verified),
    },
    deployments: {
      total: coerceMetricValue(d.total),
      successful: coerceMetricValue(d.successful ?? d.success_rate),
      successRate: coerceMetricValue(d.success_rate),
    },
    security:
      typeof m.security === "object" && m.security
        ? (m.security as SystemMetrics["security"])
        : DEFAULT_METRICS.security,
    performance:
      typeof m.performance === "object" && m.performance
        ? (m.performance as SystemMetrics["performance"])
        : DEFAULT_METRICS.performance,
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
      const [metricsRes, workflowsRes] = await Promise.allSettled([
        withAsyncTimeout(
          getMetrics(),
          CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
          "Dashboard metrics",
        ),
        withAsyncTimeout(
          getWorkflows({ limit }),
          CRITICAL_ROUTE_SETTLE_TIMEOUT_MS,
          "Dashboard workflows",
        ),
      ]);

      if (metricsRes.status === "fulfilled") {
        setMetrics(normalizeMetrics(metricsRes.value));
      } else {
        setMetrics(DEFAULT_METRICS);
      }

      if (workflowsRes.status === "fulfilled") {
        const wData = workflowsRes.value as WorkflowApiResponse;
        const list = Array.isArray(workflowsRes.value)
          ? workflowsRes.value
          : (wData?.workflows ?? []);
        const total =
          typeof (workflowsRes.value as unknown as { total?: number }).total ===
          "number"
            ? (workflowsRes.value as unknown as { total: number }).total
            : list.length;
        setWorkflows(list);
        setWorkflowsTotal(total);
        setDeployments(workflowsToDeployments(list));
      } else {
        setWorkflows([]);
        setWorkflowsTotal(0);
        setDeployments([]);
      }

      const failures = [metricsRes, workflowsRes]
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        )
        .map((result) =>
          getErrorMessage(result.reason, "Failed to load dashboard"),
        );
      if (failures.length > 0) {
        setError(failures.join("\n"));
      }
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
