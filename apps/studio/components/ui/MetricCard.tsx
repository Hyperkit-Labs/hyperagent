"use client";

import { type ReactNode } from "react";
import { GlassCard } from "./GlassCard";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  className?: string;
  hover?: boolean;
}

export function MetricCard({ label, value, sublabel, icon, className = "", hover = true }: MetricCardProps) {
  return (
    <GlassCard className={`p-5 flex flex-col justify-between h-32 ${className}`.trim()} hover={hover}>
      <div className="flex items-center justify-between">
        <span className="text-[var(--color-text-tertiary)] text-xs font-medium">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight">{value}</div>
        {sublabel && (
          <span className="text-[11px] text-[var(--color-text-dim)] mt-1 block">{sublabel}</span>
        )}
      </div>
    </GlassCard>
  );
}
