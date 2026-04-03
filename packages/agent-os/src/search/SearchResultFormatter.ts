/**
 * SearchResultFormatter: stable result schema for UI and agent consumption.
 *
 * Transforms raw SearchResponse into display-ready structures:
 *   - grouped by file
 *   - sorted by relevance / line number
 *   - includes summary stats
 *   - respects truncation caps
 */

import type { SearchMatch, SearchResponse, SearchMode } from "./types.js";

export interface GroupedFileResult {
  readonly filePath: string;
  readonly matches: readonly FormattedMatch[];
  readonly matchCount: number;
}

export interface FormattedMatch {
  readonly filePath: string;
  readonly line?: number;
  readonly column?: number;
  readonly snippet: string;
  readonly matchedText?: string;
  readonly mode: SearchMode;
  readonly severity?: "info" | "warning" | "error";
  readonly ruleId?: string;
  readonly contextBefore?: readonly string[];
  readonly contextAfter?: readonly string[];
}

export interface FormattedSearchResult {
  readonly query?: string;
  readonly mode: SearchMode;
  readonly totalMatches: number;
  readonly filesMatched: number;
  readonly elapsedMs: number;
  readonly truncated: boolean;
  readonly warnings: readonly string[];
  readonly groups: readonly GroupedFileResult[];
  readonly summary: string;
}

function toFormattedMatch(m: SearchMatch): FormattedMatch {
  return {
    filePath: m.filePath,
    line: m.line,
    column: m.column,
    snippet: m.snippet,
    matchedText: m.matchedText,
    mode: m.searchMode,
    severity: m.severity,
    ruleId: m.ruleId,
    contextBefore: m.contextBefore,
    contextAfter: m.contextAfter,
  };
}

function groupByFile(matches: readonly SearchMatch[]): GroupedFileResult[] {
  const map = new Map<string, FormattedMatch[]>();
  for (const m of matches) {
    const formatted = toFormattedMatch(m);
    const list = map.get(m.filePath);
    if (list) {
      list.push(formatted);
    } else {
      map.set(m.filePath, [formatted]);
    }
  }

  const groups: GroupedFileResult[] = [];
  for (const [filePath, fileMatches] of map) {
    const sorted = [...fileMatches].sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    groups.push({ filePath, matches: sorted, matchCount: sorted.length });
  }
  return groups.sort((a, b) => b.matchCount - a.matchCount);
}

function buildSummary(res: SearchResponse): string {
  const parts: string[] = [];
  parts.push(`${res.totalMatches} match${res.totalMatches === 1 ? "" : "es"}`);
  parts.push(`${res.filesMatched} file${res.filesMatched === 1 ? "" : "s"}`);
  parts.push(`${res.elapsedMs}ms`);
  if (res.truncated) parts.push("(truncated)");
  return parts.join(" / ");
}

export function formatSearchResult(response: SearchResponse): FormattedSearchResult {
  return {
    query: response.query,
    mode: response.mode,
    totalMatches: response.totalMatches,
    filesMatched: response.filesMatched,
    elapsedMs: response.elapsedMs,
    truncated: response.truncated,
    warnings: [...response.warnings],
    groups: groupByFile(response.matches),
    summary: buildSummary(response),
  };
}

export function formatMatchAsOneliner(m: SearchMatch): string {
  const loc = m.line ? `:${m.line}${m.column ? `:${m.column}` : ""}` : "";
  return `${m.filePath}${loc}  ${m.snippet}`;
}

export function formatResponseAsText(response: SearchResponse): string {
  const lines: string[] = [];
  lines.push(`# Search: ${response.mode}${response.query ? ` "${response.query}"` : ""}`);
  lines.push(`${buildSummary(response)}`);
  lines.push("");

  for (const m of response.matches) {
    lines.push(formatMatchAsOneliner(m));
  }

  if (response.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    for (const w of response.warnings) {
      lines.push(`- ${w}`);
    }
  }

  return lines.join("\n");
}
