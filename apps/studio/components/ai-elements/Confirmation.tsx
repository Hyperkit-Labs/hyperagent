"use client";

import { Check, X } from "lucide-react";

export type ConfirmationStatus = "pending" | "approved" | "rejected";

export interface ConfirmationProps {
  /** Title or question (e.g. "Run this?"). */
  title: string;
  /** Optional description. */
  description?: string;
  /** Current status. */
  status?: ConfirmationStatus;
  /** Callback when user approves. */
  onApprove?: () => void;
  /** Callback when user rejects. */
  onReject?: () => void;
  /** Approve button label. */
  approveLabel?: string;
  /** Reject button label. */
  rejectLabel?: string;
  disabled?: boolean;
  className?: string;
}

/** Approval UI for human-in-the-loop tool calls. Aligns with registry Confirmation (AI SDK approval states). */
export function Confirmation({
  title,
  description,
  status = "pending",
  onApprove,
  onReject,
  approveLabel = "Approve",
  rejectLabel = "Reject",
  disabled = false,
  className = "",
}: ConfirmationProps) {
  const isPending = status === "pending";

  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4 ${className}`}
    >
      <div className="font-medium text-[var(--color-text-primary)] text-[13px]">
        {title}
      </div>
      {description && (
        <div className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
          {description}
        </div>
      )}
      {status === "approved" && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-semantic-success)]">
          <Check className="w-4 h-4" />
          Approved
        </div>
      )}
      {status === "rejected" && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--color-semantic-error)]">
          <X className="w-4 h-4" />
          Rejected
        </div>
      )}
      {isPending && (onApprove || onReject) && (
        <div className="mt-3 flex items-center gap-2">
          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              disabled={disabled}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--color-primary)] text-[var(--color-text-primary)] hover:opacity-90 disabled:opacity-50"
            >
              {approveLabel}
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              disabled={disabled}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
            >
              {rejectLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
