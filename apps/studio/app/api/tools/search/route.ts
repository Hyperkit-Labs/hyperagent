/**
 * Search API route: executes workspace search via ripgrep on the server.
 *
 * POST /api/tools/search
 * Body: SearchRequest (mode, query, regex, etc.)
 * Response: SearchResponse | { error: string }
 *
 * workspaceRoot is always overridden server-side (never trust client input).
 */

import { NextRequest, NextResponse } from "next/server";

import type {
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchMatch,
} from "@/lib/tools/search";
import {
  SEARCH_MODES,
  DEFAULT_MAX_RESULTS,
  MAX_QUERY_LENGTH,
  MAX_REGEX_LENGTH,
} from "@/lib/tools/search";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

const DANGEROUS_SHELL = /[;&|`$(){}[\]<>!\\]/;
const DANGEROUS_GLOB = /[;&|`$!\\<>]/;

function isGlobSafe(g: string): boolean {
  return (
    typeof g === "string" &&
    g.length <= 200 &&
    !DANGEROUS_GLOB.test(g) &&
    !g.includes("..")
  );
}

function validateRequest(
  body: unknown,
): { ok: true; req: SearchRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;

  const mode = raw.mode as string | undefined;
  if (!mode || !SEARCH_MODES.includes(mode as SearchMode)) {
    return {
      ok: false,
      error: `Invalid mode. Must be one of: ${SEARCH_MODES.join(", ")}`,
    };
  }

  if (raw.query !== undefined) {
    if (typeof raw.query !== "string" || raw.query.length > MAX_QUERY_LENGTH) {
      return {
        ok: false,
        error: `query must be a string under ${MAX_QUERY_LENGTH} chars`,
      };
    }
    if (DANGEROUS_SHELL.test(raw.query)) {
      return { ok: false, error: "query contains disallowed characters" };
    }
  }

  if (raw.regex !== undefined) {
    if (typeof raw.regex !== "string" || raw.regex.length > MAX_REGEX_LENGTH) {
      return {
        ok: false,
        error: `regex must be a string under ${MAX_REGEX_LENGTH} chars`,
      };
    }
    try {
      new RegExp(raw.regex);
    } catch {
      return { ok: false, error: "Invalid regex pattern" };
    }
  }

  if (
    !raw.query &&
    !raw.regex &&
    mode !== "scaffold" &&
    mode !== "risk" &&
    mode !== "todo"
  ) {
    return {
      ok: false,
      error: "Either query or regex is required for this mode",
    };
  }

  const includeGlobs = Array.isArray(raw.includeGlobs)
    ? (raw.includeGlobs as string[]).filter(isGlobSafe)
    : undefined;
  const excludeGlobs = Array.isArray(raw.excludeGlobs)
    ? (raw.excludeGlobs as string[]).filter(isGlobSafe)
    : undefined;

  const paths = Array.isArray(raw.paths)
    ? (raw.paths as string[]).filter(
        (p) => typeof p === "string" && !p.includes("..") && p.length <= 500,
      )
    : undefined;

  const maxResults =
    typeof raw.maxResults === "number"
      ? Math.min(Math.max(1, Math.floor(raw.maxResults)), 1000)
      : DEFAULT_MAX_RESULTS;

  const req: SearchRequest = {
    mode: mode as SearchMode,
    query: typeof raw.query === "string" ? raw.query : undefined,
    regex: typeof raw.regex === "string" ? raw.regex : undefined,
    caseSensitive: raw.caseSensitive === true,
    wholeWord: raw.wholeWord === true,
    includeGlobs,
    excludeGlobs,
    maxResults,
    contextLines:
      typeof raw.contextLines === "number"
        ? Math.min(Math.max(0, raw.contextLines), 10)
        : undefined,
    workspaceRoot: WORKSPACE_ROOT,
    includeHidden: raw.includeHidden === true,
    includeIgnored: raw.includeIgnored === true,
    paths,
    rules: Array.isArray(raw.rules)
      ? (raw.rules as string[]).filter((r) => typeof r === "string")
      : undefined,
  };

  return { ok: true, req };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateRequest(body);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { req } = validation;

    const { WorkspaceSearchService } = await import("@/lib/tools/search");
    const service = new WorkspaceSearchService();
    const result: SearchResponse = await service.search(req);

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal search error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
