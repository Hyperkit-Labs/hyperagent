"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SearchMode, SearchResponse } from "@/lib/tools/search";
import {
  SEARCH_MODES,
  searchWorkspace,
  isSearchError,
} from "@/lib/tools/search";
import { GlassCard } from "@/components/ui/GlassCard";
import { ToolResultList } from "./ToolResultList";
import { ToolEmptyState } from "./ToolEmptyState";

const MODE_LABELS: Record<SearchMode, string> = {
  content: "Content",
  filename: "File name",
  todo: "TODOs",
  symbol: "Symbol",
  env: "Env vars",
  export: "Exports",
  risk: "Risk scan",
  scaffold: "Scaffold verify",
};

const MODE_PLACEHOLDERS: Record<SearchMode, string> = {
  content: "Search file contents...",
  filename: "Find files by name...",
  todo: "Filter TODOs (optional)...",
  symbol: "Symbol name...",
  env: "Env var name (optional)...",
  export: "Export name (optional)...",
  risk: "Scan for risky patterns",
  scaffold: "Verify scaffold integrity",
};

interface SearchState {
  loading: boolean;
  result: SearchResponse | null;
  error: string | null;
}

interface SelectedMatch {
  filePath: string;
  line?: number;
  snippet?: string;
}

export function SearchPanel() {
  const [mode, setMode] = useState<SearchMode>("content");
  const [query, setQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(
    null,
  );
  const [state, setState] = useState<SearchState>({
    loading: false,
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const noQueryNeeded =
    mode === "risk" || mode === "scaffold" || mode === "todo";

  const handleSearch = useCallback(async () => {
    if (!noQueryNeeded && !query.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ loading: true, result: null, error: null });

    const result = await searchWorkspace(
      {
        mode,
        query: query.trim() || undefined,
        maxResults: 200,
      },
      controller.signal,
    );

    if (controller.signal.aborted) return;

    if (isSearchError(result)) {
      setState({ loading: false, result: null, error: result.error });
    } else {
      setState({ loading: false, result, error: null });
      setSelectedMatch(null);
    }
  }, [mode, query, noQueryNeeded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch],
  );

  const handleFileClick = useCallback(
    (filePath: string, line?: number) => {
      const clicked = state.result?.matches.find(
        (match) => match.filePath === filePath && match.line === line,
      );
      setSelectedMatch({
        filePath,
        line,
        snippet: clicked?.snippet,
      });
    },
    [state.result],
  );

  return (
    <GlassCard className="p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          className="text-[var(--color-primary-light)] flex-shrink-0"
        >
          <circle
            cx="8.5"
            cy="8.5"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M13 13L17 17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Search
        </h3>
      </div>

      <div className="flex flex-wrap gap-1">
        {SEARCH_MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setState({ loading: false, result: null, error: null });
            }}
            className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
              mode === m
                ? "bg-[var(--color-primary-alpha-20)] border-[var(--color-primary-alpha-30)] text-[var(--color-primary-light)]"
                : "bg-transparent border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-tertiary)] hover:border-[var(--color-border-default)]"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={MODE_PLACEHOLDERS[mode]}
          disabled={state.loading}
          className="flex-1 bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-alpha-40)] transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={state.loading || (!noQueryNeeded && !query.trim())}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary-alpha-20)] text-[var(--color-primary-light)] border border-[var(--color-primary-alpha-30)] hover:bg-[var(--color-primary-alpha-30)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {state.loading ? "..." : "Search"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {state.loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-6"
          >
            <div className="w-4 h-4 rounded-full border-2 border-[var(--color-primary-alpha-40)] border-t-[var(--color-primary-light)] animate-spin" />
          </motion.div>
        )}

        {!state.loading && state.error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            {state.error}
          </motion.div>
        )}

        {!state.loading &&
          !state.error &&
          state.result &&
          state.result.matches.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ToolEmptyState
                title="No matches"
                description={`No ${MODE_LABELS[mode].toLowerCase()} found${query ? ` for "${query}"` : ""}.`}
                suggestions={[
                  "Try a broader query",
                  "Check file globs",
                  "Toggle hidden files",
                ]}
              />
            </motion.div>
          )}

        {!state.loading &&
          !state.error &&
          state.result &&
          state.result.matches.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {state.result.totalMatches} match
                  {state.result.totalMatches === 1 ? "" : "es"} in{" "}
                  {state.result.filesMatched} file
                  {state.result.filesMatched === 1 ? "" : "s"} &middot;{" "}
                  {state.result.elapsedMs}ms
                </span>
                {state.result.truncated && (
                  <span className="text-[10px] text-amber-400">Truncated</span>
                )}
              </div>

              {state.result.warnings.length > 0 && (
                <div className="mb-2 text-[10px] text-amber-400">
                  {state.result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              <ToolResultList
                matches={state.result.matches}
                mode={state.result.mode}
                onFileClick={handleFileClick}
              />
              {selectedMatch && (
                <div className="mt-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {selectedMatch.filePath}
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        {selectedMatch.line != null
                          ? `Line ${selectedMatch.line}`
                          : "No line number available"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            selectedMatch.line != null
                              ? `${selectedMatch.filePath}:${selectedMatch.line}`
                              : selectedMatch.filePath,
                          );
                        } catch {
                          // Ignore clipboard failures in restricted browsers.
                        }
                      }}
                      className="rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                    >
                      Copy path
                    </button>
                  </div>
                  {selectedMatch.snippet && (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--color-bg-surface)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                      {selectedMatch.snippet}
                    </pre>
                  )}
                </div>
              )}
            </motion.div>
          )}

        {!state.loading && !state.error && !state.result && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ToolEmptyState
              title="Workspace Search"
              description="Search your codebase for content, files, symbols, TODOs, env vars, exports, or risky patterns."
              suggestions={[
                "TODOs",
                "process.env",
                "eval()",
                "scaffold verify",
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
