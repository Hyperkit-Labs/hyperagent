"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { ROUTES } from "@/constants/routes";

export type ToolStatus = "pending" | "running" | "result" | "error";

export interface ToolProps {
  toolName: string;
  status?: ToolStatus;
  input?: unknown;
  result?: { workflow_id?: string; message?: string } | null;
  error?: string;
}

/** Header row: tool name + status. Aligns with registry ToolHeader. */
export function ToolHeader({
  toolName,
  status,
  error,
  children,
}: {
  toolName: string;
  status?: ToolStatus;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[11px] font-medium text-[var(--color-primary-light)]">
        {toolName}
      </span>
      {status === "running" && (
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Running...
        </span>
      )}
      {status === "error" && error && (
        <span className="text-[10px] text-[var(--color-semantic-error)]">
          {error}
        </span>
      )}
      {children}
    </div>
  );
}

/** Wrapper for tool input JSON or custom content. */
export function ToolInput({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono text-[var(--color-text-muted)] mb-2 rounded bg-[var(--color-bg-base)] px-2 py-1 overflow-x-auto">
      {children}
    </div>
  );
}

/** Wrapper for tool result. */
export function ToolOutput({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

/** Container for tool card. */
export function ToolContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-primary-alpha-20)] bg-[var(--color-primary-alpha-10)] p-3">
      {children}
    </div>
  );
}

export function Tool({
  toolName,
  status = "result",
  input,
  result,
  error,
}: ToolProps) {
  const isCreateWorkflow = toolName === "create_workflow";
  const hasWorkflowId = result?.workflow_id;

  return (
    <ToolContent>
      <ToolHeader toolName={toolName} status={status} error={error} />
      {result && (
        <ToolOutput>
          <p>{result.message ?? "Done."}</p>
        </ToolOutput>
      )}
      {isCreateWorkflow && hasWorkflowId && (
        <Link
          href={`${ROUTES.CHAT}?workflow=${result!.workflow_id}`}
          className="mt-2 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
        >
          <Rocket className="w-3.5 h-3.5" />
          Open in builder
        </Link>
      )}
    </ToolContent>
  );
}
