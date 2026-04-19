"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandableToolbarProps {
  label: string;
  /** When true, content is hidden until expanded */
  defaultCollapsed?: boolean;
  children: ReactNode;
  className?: string;
  /** Extra class on the trigger row */
  triggerClassName?: string;
  icon?: ReactNode;
}

/**
 * Collapsible strip for secondary actions (chat presets, app bar overflow, contract tools).
 */
export function ExpandableToolbar({
  label,
  defaultCollapsed = false,
  children,
  className = "",
  triggerClassName = "",
  icon,
}: ExpandableToolbarProps) {
  const [open, setOpen] = useState(!defaultCollapsed);

  return (
    <div className={cn("flex flex-col", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
