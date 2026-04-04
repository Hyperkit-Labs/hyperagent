/**
 * Studio search tool client and shared types.
 *
 * Types mirror @hyperagent/agent-os search module so the API route
 * and UI components share a single definition without requiring
 * the agent-os package as a build dependency.
 *
 * Server-side: the API route imports WorkspaceSearchService.
 * Client-side: components call searchWorkspace() which POSTs to /api/tools/search.
 */

export type SearchMode =
  | "content"
  | "filename"
  | "todo"
  | "symbol"
  | "env"
  | "export"
  | "risk"
  | "scaffold";

export interface SearchRequest {
  mode: SearchMode;
  query?: string;
  regex?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  includeGlobs?: string[];
  excludeGlobs?: string[];
  maxResults?: number;
  contextLines?: number;
  workspaceRoot: string;
  includeHidden?: boolean;
  includeIgnored?: boolean;
  paths?: string[];
  rules?: string[];
}

export interface SearchMatch {
  filePath: string;
  line?: number;
  column?: number;
  snippet: string;
  matchedText?: string;
  matchType: SearchMode;
  ruleId?: string;
  severity?: "info" | "warning" | "error";
  searchMode: SearchMode;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface SearchResponse {
  query?: string;
  mode: SearchMode;
  totalMatches: number;
  filesMatched: number;
  elapsedMs: number;
  truncated: boolean;
  warnings: string[];
  matches: SearchMatch[];
}

export const SEARCH_MODES: readonly SearchMode[] = [
  "content",
  "filename",
  "todo",
  "symbol",
  "env",
  "export",
  "risk",
  "scaffold",
];

export const DEFAULT_MAX_RESULTS = 200;
export const MAX_QUERY_LENGTH = 500;
export const MAX_REGEX_LENGTH = 300;

export interface SearchError {
  error: string;
}

export type SearchResult = SearchResponse | SearchError;

export function isSearchError(result: SearchResult): result is SearchError {
  return "error" in result && typeof (result as SearchError).error === "string";
}

/**
 * Client-side search: POSTs to /api/tools/search.
 * workspaceRoot is always overridden server-side, so the client value is ignored.
 */
export async function searchWorkspace(
  request: Omit<SearchRequest, "workspaceRoot">,
  signal?: AbortSignal,
): Promise<SearchResult> {
  try {
    const res = await fetch("/api/tools/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        workspaceRoot: "__server_override__",
      }),
      signal,
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.error ?? `Search failed (${res.status})` };
    }

    return data as SearchResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { error: "Search cancelled" };
    }
    return { error: err instanceof Error ? err.message : "Network error" };
  }
}

export { WorkspaceSearchService } from "./searchService";
