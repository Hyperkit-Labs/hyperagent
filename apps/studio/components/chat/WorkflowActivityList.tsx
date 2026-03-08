"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import type { Workflow } from "@/lib/types";
import { needsSpecApproval, needsDeployApproval, hasAuditOrSimFailure } from "@/lib/types";

export interface WorkflowActivityListProps {
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string) => void;
  loading?: boolean;
}

export function WorkflowActivityList({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  loading = false,
}: WorkflowActivityListProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const currentOrLast = workflows[0] ?? null;
  const historyItems = workflows.filter((w) => w.workflow_id !== currentOrLast?.workflow_id);
  const hasHistory = historyItems.length > 0;

  function renderWorkflowItem(w: Workflow) {
    return (
      <button
        key={w.workflow_id}
        type="button"
        onClick={() => onSelectWorkflow(w.workflow_id)}
        className={`w-full text-left px-2 py-1.5 rounded-md transition-colors text-[11px] truncate block ${
          selectedWorkflowId === w.workflow_id
            ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
        }`}
        title={w.intent || w.workflow_id}
      >
        <span className="font-medium truncate block">{w.name || w.intent || w.workflow_id}</span>
        <span className="flex flex-wrap items-center gap-1 mt-0.5">
          <StatusBadge status={w.status} />
          {needsSpecApproval(w) && <StatusBadge status="Spec" variant="spec" title="Spec ready for approval" />}
          {needsDeployApproval(w) && <StatusBadge status="Deploy" variant="spec" title="Deploy ready for approval" />}
          {hasAuditOrSimFailure(w) && <StatusBadge status="Audit/Sim failed" variant="audit-failed" />}
        </span>
      </button>
    );
  }

  if (loading && !workflows.length) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] py-2 px-2">Loading...</div>
    );
  }

  if (!workflows.length) {
    return (
      <div className="text-[11px] text-[var(--color-text-muted)] py-2 px-2">No workflows yet.</div>
    );
  }

  return (
    <div className="space-y-1">
      {currentOrLast && (
        <div className="px-2 py-1">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Current
          </span>
          <div className="mt-1">{renderWorkflowItem(currentOrLast)}</div>
        </div>
      )}
      {hasHistory && (
        <div className="border-t border-[var(--color-border-subtle)] pt-2">
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] transition-colors"
          >
            {historyExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <Clock className="w-3.5 h-3.5" />
            History ({historyItems.length})
          </button>
          {historyExpanded && (
            <ul className="mt-1 space-y-0.5 px-2 max-h-[200px] overflow-y-auto">
              {historyItems.map((w) => (
                <li key={w.workflow_id}>{renderWorkflowItem(w)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
