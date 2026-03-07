"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { approveSpec, getWorkflow, getWorkflowContracts } from "@/lib/api";
import type { Workflow } from "@/lib/types";
import { hasAuditOrSimFailure } from "@/lib/types";
import { WorkflowStages } from "./WorkflowStages";
import { ArrowLeft, Loader2, CheckCircle, Rocket } from "lucide-react";

export interface WorkflowRunState {
  workflow: Workflow | null;
  contractData: { bytecode?: string; source_code?: string; [key: string]: unknown } | null;
  loading: boolean;
  error: string | null;
  approving: boolean;
  approveError: string | null;
}

export interface WorkflowRunActions {
  refetch: () => Promise<void>;
  approve: () => Promise<void>;
}

export interface WorkflowRunContextValue {
  state: WorkflowRunState;
  actions: WorkflowRunActions;
}

export const WorkflowRunContext = createContext<WorkflowRunContextValue | null>(null);

export function WorkflowRunProvider({
  workflowId,
  children,
}: {
  workflowId: string;
  children: React.ReactNode;
}) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [contractData, setContractData] = useState<WorkflowRunState["contractData"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setError(null);
    try {
      const [wf, list] = await Promise.all([
        getWorkflow(workflowId),
        getWorkflowContracts(workflowId).catch(() => []),
      ]);
      setWorkflow(wf);
      const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
      setContractData(first ? { bytecode: first.bytecode as string | undefined, source_code: first.source_code as string | undefined, ...first } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }
    void refetch();
  }, [workflowId, refetch]);

  const approve = useCallback(async () => {
    if (!workflow?.workflow_id) return;
    setApproveError(null);
    setApproving(true);
    try {
      await approveSpec(workflow.workflow_id);
      await refetch();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "Failed to approve spec");
    } finally {
      setApproving(false);
    }
  }, [workflow?.workflow_id, refetch]);

  const state: WorkflowRunState = {
    workflow: workflow ?? null,
    contractData,
    loading,
    error: error ?? null,
    approving,
    approveError,
  };

  const actions: WorkflowRunActions = {
    refetch,
    approve,
  };

  const value: WorkflowRunContextValue = { state, actions };

  return (
    <WorkflowRunContext.Provider value={value}>
      {children}
    </WorkflowRunContext.Provider>
  );
}

function statusPillClass(status: string): string {
  if (status === "completed" || status === "success") return "status-pill-ready";
  if (status === "failed") return "status-pill-failed";
  if (status === "building" || status === "running" || status === "deploying" || status === "generating") return "status-pill-building";
  return "status-pill-queued";
}

export function needsSpecApproval(workflow: {
  status?: string;
  spec?: unknown;
  spec_approved?: boolean;
  needs_human_approval?: boolean;
  auto_approve?: boolean;
}): boolean {
  if (workflow.auto_approve) return false;
  return (
    Boolean(workflow.status === "building" || workflow.status === "running") &&
    Boolean(workflow.spec) &&
    (workflow.needs_human_approval === true || workflow.spec_approved === false)
  );
}

export function WorkflowRunHeader() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow } = ctx.state;
  if (!workflow) return null;
  return (
    <>
      <div className="flex items-center gap-4">
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 text-[var(--color-text-tertiary)] hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Workflows
        </Link>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {workflow.name || workflow.intent || workflow.workflow_id}
          </h1>
          <p className="text-[var(--color-text-tertiary)] text-sm mt-1">ID: {workflow.workflow_id}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-medium ${statusPillClass(workflow.status)}`}>
          {workflow.status}
        </span>
      </div>
    </>
  );
}

export function WorkflowRunMeta() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow } = ctx.state;
  if (!workflow) return null;
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-[var(--color-text-tertiary)]">Network</span>
        <div className="text-white font-medium">{workflow.network ?? "-"}</div>
      </div>
      <div>
        <span className="text-[var(--color-text-tertiary)]">Contract type</span>
        <div className="text-white font-medium">{workflow.contract_type ?? "-"}</div>
      </div>
      <div>
        <span className="text-[var(--color-text-tertiary)]">Codegen</span>
        <div className="text-white font-medium">
          {workflow.codegen_mode === "oz_wizard"
            ? `OZ Wizard${workflow.oz_wizard_options?.kind ? ` (${workflow.oz_wizard_options.kind})` : ""}`
            : "Custom / experimental"}
        </div>
      </div>
      {workflow.template_id && (
        <div>
          <span className="text-[var(--color-text-tertiary)]">Template</span>
          <div className="text-white font-medium">{workflow.template_id}</div>
        </div>
      )}
      <div>
        <span className="text-[var(--color-text-tertiary)]">Created</span>
        <div className="text-white font-medium">{workflow.created_at ?? "-"}</div>
      </div>
      <div>
        <span className="text-[var(--color-text-tertiary)]">Updated</span>
        <div className="text-white font-medium">{workflow.updated_at ?? "-"}</div>
      </div>
    </div>
  );
}

export function WorkflowRunRiskStrip() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow } = ctx.state;
  if (!workflow) return null;
  const roma = workflow.roma_used;
  const highRisk = workflow.risk_profile === "high";
  const auditSimFailed = hasAuditOrSimFailure(workflow);
  if (!roma && !highRisk && !auditSimFailed) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-border-default)] px-3 py-2 text-[11px]">
      {roma && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded status-pill-roma" title="ROMA planner was used for this run">
          ROMA used
        </span>
      )}
      {highRisk && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20" title="High risk until reviewed">
          High risk until reviewed
        </span>
      )}
      {auditSimFailed && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20" title="Audit or simulation failed">
          Audit or simulation failed
        </span>
      )}
    </div>
  );
}

export function WorkflowRunSpecApproval() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { state, actions } = ctx;
  const { workflow, approving, approveError } = state;
  if (!workflow || !needsSpecApproval(workflow)) return null;
  return (
    <div className="rounded-lg bg-[#1F1F22] border border-[var(--color-primary)]/40 p-4">
      <h3 className="text-xs font-medium text-[var(--color-primary-light)] mb-2">Spec ready for approval</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">Review the spec above, then approve to continue the pipeline.</p>
      {approveError && (
        <p className="text-sm text-[var(--color-semantic-error)] mb-2" data-testid="approve-error">{approveError}</p>
      )}
      <button
        type="button"
        disabled={approving}
        onClick={() => actions.approve()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium disabled:opacity-60"
      >
        {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
        {approving ? "Approving…" : "Approve spec"}
      </button>
    </div>
  );
}

export function WorkflowRunStages() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow, contractData } = ctx.state;
  if (!workflow) return null;
  return (
    <div>
      <WorkflowStages workflow={workflow} contractData={contractData} />
    </div>
  );
}

export function WorkflowRunErrorBlock() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow } = ctx.state;
  if (!workflow || workflow.status !== "failed") return null;
  const err = (workflow.metadata?.error ?? workflow.meta_data?.error) as string | undefined;
  if (!err) return null;
  return (
    <div className="rounded-lg bg-[var(--color-bg-panel)] border border-[var(--color-semantic-error)]/30 p-4">
      <h3 className="text-xs font-medium text-[var(--color-semantic-error)] mb-1">Error</h3>
      <p className="text-sm text-[var(--color-text-secondary)] break-words">{err}</p>
    </div>
  );
}

export function WorkflowRunActionsBlock() {
  const ctx = React.use(WorkflowRunContext);
  if (!ctx) return null;
  const { workflow } = ctx.state;
  if (!workflow || (workflow.status !== "completed" && workflow.status !== "success")) return null;
  return (
    <Link
      href={ROUTES.APPS_ID(workflow.workflow_id)}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-primary-gradient text-white text-xs font-medium"
    >
      <Rocket className="w-3.5 h-3.5" />
      Use contract
    </Link>
  );
}
