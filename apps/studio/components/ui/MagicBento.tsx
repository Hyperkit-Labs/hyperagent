"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface MagicBentoProps {
  children: React.ReactNode;
  className?: string;
  /** Number of columns on large screens */
  columns?: 2 | 3 | 4;
}

/**
 * Dense bento with hover lift and glow (Magic Bento–style motion).
 */
export function MagicBento({
  children,
  className,
  columns = 3,
}: MagicBentoProps) {
  const cols =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={cn("grid grid-cols-1 gap-3", cols, className)}>
      {children}
    </div>
  );
}

export function MagicBentoTile({
  children,
  className,
  colSpan = 1,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: 1 | 2;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "relative rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/80 overflow-hidden group",
        colSpan === 2 && "md:col-span-2",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(167,139,250,0.15),transparent_55%)]" />
      {children}
    </motion.div>
  );
}
