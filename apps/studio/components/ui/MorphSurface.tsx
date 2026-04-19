"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MorphSurfaceProps {
  /** Always visible heading row */
  header: ReactNode;
  /** Compact body */
  summary: ReactNode;
  /** Extra content when expanded */
  detail: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  toggleLabelCollapsed?: string;
  toggleLabelExpanded?: string;
}

/**
 * Card region that shifts between a compact summary and expanded detail without navigation.
 */
export function MorphSurface({
  header,
  summary,
  detail,
  defaultExpanded = false,
  className = "",
  toggleLabelCollapsed = "Show more",
  toggleLabelExpanded = "Show less",
}: MorphSurfaceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/40",
        className,
      )}
    >
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3">
        {header}
      </div>
      <div className="px-4 py-3">{summary}</div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-[var(--color-border-subtle)]"
          >
            <div className="px-4 py-3">{detail}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-center gap-1 border-t border-[var(--color-border-subtle)] px-3 py-2 text-[11px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
      >
        {expanded ? toggleLabelExpanded : toggleLabelCollapsed}
        <ChevronDown
          className={cn("h-3.5 w-3.5", expanded ? "rotate-180" : "")}
        />
      </button>
    </div>
  );
}
