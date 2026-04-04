"use client";

import { useState } from "react";
import { ShieldAlert, Undo2, RotateCcw, Loader2 } from "lucide-react";
import {
  quarantineWorkflow,
  rollbackWorkflow,
  retryWorkflow,
  getErrorMessage,
} from "@/lib/api";
import type { Workflow } from "@/lib/types";
import { toast } from "sonner";

export function canRetryWorkflow(w: Workflow): boolean {
  const s = (w.status || "").toLowerCase();
  return s === "failed" || s === "cancelled";
}

export function canRollbackWorkflow(w: Workflow): boolean {
  const d = w.deployments;
  return Array.isArray(d) && d.length > 0;
}

type Props = {
  workflow: Workflow;
  onDone?: () => void;
  /** Tighter padding and text for dashboard rows */
  compact?: boolean;
  stopPropagation?: boolean;
};

const btnBase =
  "inline-flex items-center gap-1 rounded-md border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function WorkflowRecoveryControls({
  workflow,
  onDone,
  compact = false,
  stopPropagation = true,
}: Props) {
  const [busy, setBusy] = useState<"quarantine" | "rollback" | "retry" | null>(
    null,
  );
  const id = workflow.workflow_id;
  const pad = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";

  const wrapClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  const optionalReason = (title: string): string => {
    if (typeof window === "undefined") return "";
    const r = window.prompt(`${title}\n\nOptional reason:`, "");
    return r ?? "";
  };

  const onQuarantine = async (e: React.MouseEvent) => {
    wrapClick(e);
    if (
      !window.confirm(
        "Quarantine this workflow? It will be marked failed and blocked.",
      )
    )
      return;
    const reason = optionalReason("Quarantine");
    setBusy("quarantine");
    try {
      await quarantineWorkflow(id, { reason });
      toast.success("Workflow quarantined");
      onDone?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Quarantine failed"));
    } finally {
      setBusy(null);
    }
  };

  const onRollback = async (e: React.MouseEvent) => {
    wrapClick(e);
    if (!canRollbackWorkflow(workflow)) {
      toast.error("Rollback needs at least one deployment on this workflow");
      return;
    }
    if (
      !window.confirm(
        "Request rollback? Status becomes cancelled and rollback is recorded.",
      )
    )
      return;
    const reason = optionalReason("Rollback");
    setBusy("rollback");
    try {
      await rollbackWorkflow(id, { reason });
      toast.success("Rollback requested");
      onDone?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Rollback failed"));
    } finally {
      setBusy(null);
    }
  };

  const onRetry = async (e: React.MouseEvent) => {
    wrapClick(e);
    if (!canRetryWorkflow(workflow)) {
      toast.error("Retry is only for failed or cancelled workflows");
      return;
    }
    if (
      !window.confirm(
        "Retry this workflow? It will run again from the spec stage.",
      )
    )
      return;
    setBusy("retry");
    try {
      await retryWorkflow(id);
      toast.success("Workflow retry started");
      onDone?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Retry failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? "" : "gap-1.5"}`}
      role="group"
      aria-label="Recovery actions"
    >
      <button
        type="button"
        onClick={onQuarantine}
        disabled={busy !== null}
        title="Quarantine outputs (fail-closed)"
        className={`${btnBase} ${pad} border-amber-500/35 text-amber-400 hover:bg-amber-500/10`}
      >
        {busy === "quarantine" ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <ShieldAlert className="w-3 h-3 shrink-0" />
        )}
        Quarantine
      </button>
      <button
        type="button"
        onClick={onRollback}
        disabled={busy !== null || !canRollbackWorkflow(workflow)}
        title={
          canRollbackWorkflow(workflow)
            ? "Request rollback to last deployment"
            : "Needs a deployment record"
        }
        className={`${btnBase} ${pad} border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]`}
      >
        {busy === "rollback" ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <Undo2 className="w-3 h-3 shrink-0" />
        )}
        Rollback
      </button>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy !== null || !canRetryWorkflow(workflow)}
        title={
          canRetryWorkflow(workflow)
            ? "Retry from spec stage"
            : "Only for failed or cancelled workflows"
        }
        className={`${btnBase} ${pad} border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10`}
      >
        {busy === "retry" ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <RotateCcw className="w-3 h-3 shrink-0" />
        )}
        Retry
      </button>
    </div>
  );
}
