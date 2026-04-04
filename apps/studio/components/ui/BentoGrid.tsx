"use client";

import { type ReactNode } from "react";

export interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = "" }: BentoGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr ${className}`}
    >
      {children}
    </div>
  );
}

export interface BentoCardProps {
  children: ReactNode;
  /** Span across columns on lg screens. */
  colSpan?: 1 | 2 | 3 | 4;
  /** Span across rows. */
  rowSpan?: 1 | 2;
  className?: string;
}

const COL_SPAN_CLASSES: Record<number, string> = {
  1: "",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
};

const ROW_SPAN_CLASSES: Record<number, string> = {
  1: "",
  2: "row-span-2",
};

export function BentoCard({
  children,
  colSpan = 1,
  rowSpan = 1,
  className = "",
}: BentoCardProps) {
  const colClass = COL_SPAN_CLASSES[colSpan] ?? "";
  const rowClass = ROW_SPAN_CLASSES[rowSpan] ?? "";
  return (
    <div
      className={`glass-panel rounded-xl overflow-hidden ${colClass} ${rowClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
