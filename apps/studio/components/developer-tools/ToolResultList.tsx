"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SearchMatch, SearchMode } from "@/lib/tools/search";

export interface ToolResultListProps {
  matches: SearchMatch[];
  mode: SearchMode;
  onFileClick?: (filePath: string, line?: number) => void;
  className?: string;
}

interface FileGroup {
  filePath: string;
  matches: SearchMatch[];
}

function groupByFile(matches: SearchMatch[]): FileGroup[] {
  const map = new Map<string, SearchMatch[]>();
  for (const m of matches) {
    const list = map.get(m.filePath);
    if (list) list.push(m);
    else map.set(m.filePath, [m]);
  }
  return Array.from(map, ([filePath, fileMatches]) => ({
    filePath,
    matches: fileMatches.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
  }));
}

function severityColor(severity?: "info" | "warning" | "error"): string {
  switch (severity) {
    case "error":
      return "text-red-400";
    case "warning":
      return "text-amber-400";
    case "info":
      return "text-blue-400";
    default:
      return "text-[var(--color-text-tertiary)]";
  }
}

function modeBadge(mode: SearchMode): string {
  const badges: Record<SearchMode, string> = {
    content: "Content",
    filename: "File",
    todo: "TODO",
    symbol: "Symbol",
    env: "Env",
    export: "Export",
    risk: "Risk",
    scaffold: "Scaffold",
  };
  return badges[mode] ?? mode;
}

export function ToolResultList({
  matches,
  mode,
  onFileClick,
  className = "",
}: ToolResultListProps) {
  const groups = groupByFile(matches);
  const [expandedFile, setExpandedFile] = useState<string | null>(
    groups.length === 1 ? groups[0].filePath : null,
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      {groups.map((group) => {
        const isExpanded = expandedFile === group.filePath;
        return (
          <div
            key={group.filePath}
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedFile(isExpanded ? null : group.filePath)
              }
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`text-[var(--color-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
              >
                <path
                  d="M4 2L8 6L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs text-[var(--color-text-secondary)] font-mono truncate flex-1">
                {group.filePath}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary-alpha-10)] text-[var(--color-primary-light)] font-medium">
                {group.matches.length}
              </span>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--color-border-subtle)]">
                    {group.matches.map((m, idx) => (
                      <button
                        key={`${m.filePath}:${m.line ?? idx}`}
                        type="button"
                        onClick={() => onFileClick?.(m.filePath, m.line)}
                        className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors border-b border-[var(--color-border-subtle)] last:border-b-0"
                      >
                        {m.line != null && (
                          <span className="text-[10px] text-[var(--color-text-muted)] font-mono w-8 text-right flex-shrink-0 pt-0.5">
                            {m.line}
                          </span>
                        )}
                        <span className="text-xs text-[var(--color-text-tertiary)] font-mono flex-1 break-all leading-relaxed">
                          {m.snippet}
                        </span>
                        {m.severity && (
                          <span
                            className={`text-[10px] flex-shrink-0 ${severityColor(m.severity)}`}
                          >
                            {m.severity}
                          </span>
                        )}
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] flex-shrink-0">
                          {modeBadge(m.searchMode)}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
