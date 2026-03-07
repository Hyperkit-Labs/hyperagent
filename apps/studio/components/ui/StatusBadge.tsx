"use client";

export type StatusBadgeVariant =
  | "success"
  | "completed"
  | "failed"
  | "building"
  | "pending"
  | "queued"
  | "warning"
  | "spec"
  | "roma"
  | "high-risk"
  | "audit-failed"
  | "active"
  | "running"
  | "idle";

function getStatusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "success" || s === "active" || s === "running") return "status-pill-ready";
  if (s === "failed") return "status-pill-failed";
  if (s === "building" || s === "deploying" || s === "generating") return "status-pill-building";
  if (s === "pending" || s === "queued" || s === "idle") return "status-pill-queued";
  return "status-pill-queued";
}

function getVariantClass(variant: StatusBadgeVariant): string {
  switch (variant) {
    case "success":
    case "completed":
      return "status-pill-ready";
    case "active":
    case "running":
      return "status-pill-ready";
    case "failed":
    case "high-risk":
    case "audit-failed":
      return "status-pill-failed";
    case "building":
    case "pending":
    case "queued":
      return variant === "building" ? "status-pill-building" : "status-pill-queued";
    case "warning":
      return "bg-[var(--color-semantic-warning)]/20 text-[var(--color-semantic-warning)] border border-[var(--color-semantic-warning)]/30";
    case "spec":
      return "status-pill-spec";
    case "roma":
      return "status-pill-roma";
    default:
      return "status-pill-queued";
  }
}

export interface StatusBadgeProps {
  /** Raw status string (e.g. from API) or a variant key. */
  status: string;
  /** Optional override for pill variant when status is a known type. */
  variant?: StatusBadgeVariant;
  title?: string;
  className?: string;
}

const VARIANT_KEYS: Set<string> = new Set([
  "success", "completed", "failed", "building", "pending", "queued", "warning",
  "spec", "roma", "high-risk", "audit-failed", "active", "running", "idle",
]);

export function StatusBadge({ status, variant, title, className = "" }: StatusBadgeProps) {
  const pillClass = variant
    ? getVariantClass(variant)
    : (VARIANT_KEYS.has(status.toLowerCase()) ? getVariantClass(status as StatusBadgeVariant) : getStatusPillClass(status));
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${pillClass} ${className}`.trim()}
      title={title ?? status}
    >
      {status}
    </span>
  );
}
