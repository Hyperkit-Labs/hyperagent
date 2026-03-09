"use client";

import { Loader2 } from "lucide-react";

export type StatusBadgeVariant =
  | "success"
  | "completed"
  | "failed"
  | "building"
  | "analyzing"
  | "pending"
  | "queued"
  | "warning"
  | "spec"
  | "roma"
  | "high-risk"
  | "audit-failed"
  | "active"
  | "running"
  | "idle"
  | "urgent";

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
    case "urgent":
      return "bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_6px_rgba(239,68,68,0.2)]";
    case "building":
    case "analyzing":
    case "pending":
    case "queued":
      return variant === "building" || variant === "analyzing" ? "status-pill-building" : "status-pill-queued";
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
  /** Show spinner for live/analyzing states (building, running, generating). */
  showSpinner?: boolean;
}

const VARIANT_KEYS: Set<string> = new Set([
  "success", "completed", "failed", "building", "pending", "queued", "warning",
  "spec", "roma", "high-risk", "audit-failed", "active", "running", "idle", "analyzing", "urgent",
]);

const LIVE_STATES: Set<string> = new Set([
  "building", "running", "generating", "deploying", "analyzing", "active", "scanning",
]);

const GLOW_COLORS: Record<string, string> = {
  building: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
  deploying: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]",
  scanning: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]",
  analyzing: "bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]",
  running: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  active: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  generating: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
};

function GlowingDot({ status }: { status: string }) {
  const s = status.toLowerCase();
  const colorClass = GLOW_COLORS[s] ?? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]";
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full animate-pulse ${colorClass}`}
      aria-hidden
    />
  );
}

export function StatusBadge({ status, variant, title, className = "", showSpinner }: StatusBadgeProps) {
  const pillClass = variant
    ? getVariantClass(variant)
    : (VARIANT_KEYS.has(status.toLowerCase()) ? getVariantClass(status as StatusBadgeVariant) : getStatusPillClass(status));
  const isLive = showSpinner ?? LIVE_STATES.has(status.toLowerCase());
  const useGlow = isLive && !showSpinner;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${pillClass} ${className}`.trim()}
      title={title ?? status}
    >
      {isLive && showSpinner && (
        <Loader2 className="w-3 h-3 shrink-0 animate-spin" aria-hidden />
      )}
      {useGlow && <GlowingDot status={status} />}
      {status}
    </span>
  );
}
