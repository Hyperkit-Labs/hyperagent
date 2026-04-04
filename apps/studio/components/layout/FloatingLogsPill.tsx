"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronUp, ExternalLink } from "lucide-react";
import { useLogs } from "@/hooks/useLogs";
import { Terminal } from "@/components/ai-elements";
import { ROUTES } from "@/constants/routes";

export function FloatingLogsPill() {
  const [expanded, setExpanded] = useState(false);
  const { logs, loading } = useLogs({
    autoRefresh: true,
    filters: { page_size: 5 },
  });
  const hasNewLogs = logs.length > 0;
  const terminalLines = logs
    .slice(0, 5)
    .map((entry: { message?: string; level?: string; timestamp?: string }) => ({
      timestamp: entry.timestamp ?? "",
      level: entry.level ?? "info",
      message: entry.message ?? "",
    }));

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="absolute bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] shadow-lg hover:bg-[var(--color-bg-hover)] transition-colors"
        aria-label={expanded ? "Collapse logs" : "Expand logs"}
        initial={false}
      >
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            hasNewLogs
              ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"
              : "bg-[var(--color-text-muted)]"
          }`}
        />
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          {hasNewLogs ? "Live" : "Logs"}
        </span>
        <ChevronUp
          className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 320, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-16 right-6 z-40 w-[min(400px,calc(100vw-48px))] overflow-hidden rounded-t-xl border border-b-0 border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  Recent logs
                </span>
                {hasNewLogs && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                    Live
                  </span>
                )}
              </div>
              <Link
                href={ROUTES.MONITORING}
                className="flex items-center gap-1 text-[10px] font-medium text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors"
              >
                Expand <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="h-[260px] overflow-hidden">
              {loading && terminalLines.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-xs">
                  Loading...
                </div>
              ) : (
                <Terminal
                  lines={terminalLines}
                  noScroll
                  className="rounded-none border-0 max-h-[260px] overflow-y-auto"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
