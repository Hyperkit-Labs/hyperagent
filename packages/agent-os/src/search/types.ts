/**
 * Workspace search tool types.
 *
 * Defines the typed contract for search requests, responses, and matches.
 * All search operations go through these types to enforce structured output
 * and workspace-scoped, read-only access.
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
  readonly mode: SearchMode;
  readonly query?: string;
  readonly regex?: string;
  readonly caseSensitive?: boolean;
  readonly wholeWord?: boolean;
  readonly includeGlobs?: readonly string[];
  readonly excludeGlobs?: readonly string[];
  readonly maxResults?: number;
  readonly contextLines?: number;
  readonly workspaceRoot: string;
  readonly includeHidden?: boolean;
  readonly includeIgnored?: boolean;
  readonly paths?: readonly string[];
  readonly rules?: readonly string[];
}

export interface SearchMatch {
  readonly filePath: string;
  readonly line?: number;
  readonly column?: number;
  readonly snippet: string;
  readonly matchedText?: string;
  readonly matchType: SearchMode;
  readonly ruleId?: string;
  readonly severity?: "info" | "warning" | "error";
  readonly searchMode: SearchMode;
  readonly contextBefore?: readonly string[];
  readonly contextAfter?: readonly string[];
}

export interface SearchResponse {
  readonly query?: string;
  readonly mode: SearchMode;
  readonly totalMatches: number;
  readonly filesMatched: number;
  readonly elapsedMs: number;
  readonly truncated: boolean;
  readonly warnings: readonly string[];
  readonly matches: readonly SearchMatch[];
}

export interface SearchValidationError {
  readonly field: string;
  readonly message: string;
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
] as const;

export const DEFAULT_MAX_RESULTS = 200;
export const DEFAULT_CONTEXT_LINES = 2;
export const MAX_QUERY_LENGTH = 500;
export const MAX_REGEX_LENGTH = 500;
