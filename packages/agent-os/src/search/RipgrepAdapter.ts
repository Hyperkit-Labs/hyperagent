/**
 * Safe ripgrep adapter.
 *
 * Executes `rg` via spawn with argv array (never shell interpolation).
 * Parses output into structured SearchMatch records.
 */

import { spawn } from "child_process";
import type { SearchMatch, SearchMode, SearchRequest } from "./types.js";
import { DEFAULT_CONTEXT_LINES, DEFAULT_MAX_RESULTS } from "./types.js";

export interface RipgrepResult {
  readonly matches: SearchMatch[];
  readonly truncated: boolean;
  readonly elapsedMs: number;
  readonly warnings: string[];
}

function buildArgs(req: SearchRequest): string[] {
  const args: string[] = [];
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;
  const contextLines = req.contextLines ?? DEFAULT_CONTEXT_LINES;

  switch (req.mode) {
    case "filename":
      args.push("--files");
      if (req.query) {
        args.push("--glob", `*${req.query}*`);
      }
      break;

    case "todo":
      args.push("-n", "--column");
      args.push("-e", req.query ? `(TODO|FIXME|HACK|XXX).*${req.query}` : "(TODO|FIXME|HACK|XXX)");
      break;

    case "symbol":
      args.push("-n", "--column", "-w");
      if (req.query) {
        args.push("-e", req.query);
      }
      break;

    case "env":
      args.push("-n", "--column");
      args.push("-e", req.query ?? "(process\\.env|import\\.meta\\.env|NEXT_PUBLIC_|VITE_)");
      break;

    case "export":
      args.push("-n", "--column");
      args.push("-e", req.query ?? "(^export\\s|module\\.exports)");
      break;

    case "risk":
      args.push("-n", "--column");
      args.push("-e", req.query ?? "(eval\\(|Function\\(|innerHTML|dangerouslySetInnerHTML|exec\\(|child_process)");
      break;

    case "scaffold":
    case "content":
    default:
      args.push("-n", "--column");
      if (req.regex) {
        args.push("-e", req.regex);
      } else if (req.query) {
        if (req.caseSensitive) {
          args.push("-s");
        } else {
          args.push("-i");
        }
        if (req.wholeWord) {
          args.push("-w");
        }
        args.push("-e", req.query);
      }
      break;
  }

  if (req.mode !== "filename") {
    args.push("-C", String(contextLines));
    args.push("--max-count", String(maxResults));
  }

  if (req.includeGlobs) {
    for (const g of req.includeGlobs) {
      args.push("--glob", g);
    }
  }
  if (req.excludeGlobs) {
    for (const g of req.excludeGlobs) {
      args.push("--glob", `!${g}`);
    }
  }
  if (!req.includeHidden) {
    args.push("--no-hidden");
  }
  if (req.includeIgnored) {
    args.push("--no-ignore");
  }

  if (req.paths && req.paths.length > 0) {
    args.push("--", ...req.paths);
  } else {
    args.push("--", req.workspaceRoot);
  }

  return args;
}

function parseRipgrepLine(
  line: string,
  mode: SearchMode,
): SearchMatch | null {
  const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
  if (!match) {
    const fileOnlyMatch = line.match(/^(.+)$/);
    if (mode === "filename" && fileOnlyMatch) {
      return {
        filePath: fileOnlyMatch[1].trim(),
        snippet: fileOnlyMatch[1].trim(),
        matchType: mode,
        searchMode: mode,
      };
    }
    return null;
  }

  return {
    filePath: match[1],
    line: parseInt(match[2], 10),
    column: parseInt(match[3], 10),
    snippet: match[4],
    matchType: mode,
    searchMode: mode,
  };
}

export function executeRipgrep(req: SearchRequest): Promise<RipgrepResult> {
  const start = Date.now();
  const args = buildArgs(req);
  const maxResults = req.maxResults ?? DEFAULT_MAX_RESULTS;

  return new Promise((resolve) => {
    const child = spawn("rg", args, {
      cwd: req.workspaceRoot,
      shell: false,
      timeout: 30_000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      resolve({
        matches: [],
        truncated: false,
        elapsedMs: Date.now() - start,
        warnings: [`ripgrep execution failed: ${err.message}`],
      });
    });

    child.on("close", () => {
      const lines = stdout
        .split("\n")
        .filter((l) => l.trim().length > 0 && !l.startsWith("--"));

      const matches: SearchMatch[] = [];
      for (const line of lines) {
        if (matches.length >= maxResults) break;
        const parsed = parseRipgrepLine(line, req.mode);
        if (parsed) {
          matches.push(parsed);
        }
      }

      const warnings: string[] = [];
      if (stderr.trim()) {
        warnings.push(stderr.trim().slice(0, 500));
      }

      resolve({
        matches,
        truncated: matches.length >= maxResults,
        elapsedMs: Date.now() - start,
        warnings,
      });
    });
  });
}

export { buildArgs as _buildArgs_for_testing };
