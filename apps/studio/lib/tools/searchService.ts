/**
 * Server-side WorkspaceSearchService for Studio.
 *
 * Executes ripgrep searches within the workspace root.
 * This is a lightweight re-implementation for the Next.js runtime
 * since agent-os requires a build step and targets a different module system.
 */

import { spawn } from "child_process";
import path from "path";
import type { SearchRequest, SearchResponse, SearchMatch, SearchMode } from "./search";

const DANGEROUS_PATTERNS = /[;&|`$(){}[\]<>!\\]/;
const DANGEROUS_GLOB = /[;&|`$!\\<>]/;
const MAX_LINE_LENGTH = 2000;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateGlob(g: string): boolean {
  if (DANGEROUS_GLOB.test(g)) return false;
  if (g.includes("..")) return false;
  if (g.length > 200) return false;
  return true;
}

function normalizePath(p: string, root: string): string {
  const resolved = path.resolve(root, p);
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

function buildArgs(req: SearchRequest): string[] {
  const args: string[] = ["--no-heading", "--line-number", "--column", "--color=never"];

  if (!req.caseSensitive) args.push("--ignore-case");
  if (req.wholeWord) args.push("--word-regexp");
  if (req.includeHidden) args.push("--hidden");
  if (req.includeIgnored) args.push("--no-ignore");
  if (req.maxResults) args.push("--max-count", String(req.maxResults));
  if (req.contextLines && req.contextLines > 0) args.push(`-C${req.contextLines}`);

  if (req.includeGlobs) {
    for (const g of req.includeGlobs) {
      if (validateGlob(g)) args.push("--glob", g);
    }
  }
  if (req.excludeGlobs) {
    for (const g of req.excludeGlobs) {
      if (validateGlob(g)) args.push("--glob", `!${g}`);
    }
  }

  const safeQ = req.query ? escapeRegex(req.query) : "";

  switch (req.mode) {
    case "filename": {
      const globArg = req.query && validateGlob(req.query) ? ["--glob", `*${req.query}*`] : [];
      return ["--files", ...globArg, req.workspaceRoot];
    }

    case "todo":
      args.push("-e", safeQ ? `(TODO|FIXME|HACK|XXX).*${safeQ}` : "(TODO|FIXME|HACK|XXX)");
      break;

    case "symbol":
      if (req.query) {
        args.push("--word-regexp", "-e", escapeRegex(req.query));
      }
      break;

    case "env":
      args.push("-e", safeQ
        ? `(process\\.env|import\\.meta\\.env|NEXT_PUBLIC_).*${safeQ}`
        : "(process\\.env\\.|import\\.meta\\.env\\.|NEXT_PUBLIC_)");
      break;

    case "export":
      args.push("-e", safeQ
        ? `export\\s+(default\\s+)?(function|class|const|let|var|type|interface|enum)\\s+${safeQ}`
        : "^export\\s+(default\\s+)?(function|class|const|let|var|type|interface|enum)\\s+");
      break;

    case "risk":
      args.push("-e", "\\beval\\s*\\(|new\\s+Function\\s*\\(|innerHTML\\s*=|dangerouslySetInnerHTML|__proto__|constructor\\[");
      break;

    case "scaffold":
      return args;

    case "content":
    default:
      if (req.regex) {
        args.push("-e", req.regex);
      } else if (req.query) {
        args.push("--fixed-strings", "-e", req.query);
      }
      break;
  }

  args.push(req.workspaceRoot);
  return args;
}

function parseRgOutput(stdout: string, mode: SearchMode): SearchMatch[] {
  const matches: SearchMatch[] = [];

  if (mode === "filename") {
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      matches.push({
        filePath: trimmed,
        snippet: trimmed,
        matchType: mode,
        searchMode: mode,
      });
    }
    return matches;
  }

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    if (line.length > MAX_LINE_LENGTH) continue;

    const fileMatch = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
    if (fileMatch) {
      matches.push({
        filePath: fileMatch[1],
        line: parseInt(fileMatch[2], 10),
        column: parseInt(fileMatch[3], 10),
        snippet: fileMatch[4].trim(),
        matchType: mode,
        searchMode: mode,
      });
    }
  }
  return matches;
}

function runRg(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn("rg", args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
      if (stdout.length > 2_000_000) {
        proc.kill("SIGTERM");
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    proc.on("error", () => {
      resolve({ stdout, stderr, code: 1 });
    });
  });
}

export class WorkspaceSearchService {
  async search(req: SearchRequest): Promise<SearchResponse> {
    const start = Date.now();

    if (req.query && DANGEROUS_PATTERNS.test(req.query)) {
      return {
        mode: req.mode,
        totalMatches: 0,
        filesMatched: 0,
        elapsedMs: Date.now() - start,
        truncated: false,
        warnings: ["Query contains disallowed characters"],
        matches: [],
      };
    }

    if (req.mode === "scaffold") {
      return this.runScaffoldCheck(req, start);
    }

    const args = buildArgs(req);
    const { stdout, code } = await runRg(args, req.workspaceRoot);

    if (code !== 0 && code !== 1) {
      return {
        mode: req.mode,
        totalMatches: 0,
        filesMatched: 0,
        elapsedMs: Date.now() - start,
        truncated: false,
        warnings: ["ripgrep exited with non-standard code"],
        matches: [],
      };
    }

    const allMatches = parseRgOutput(stdout, req.mode);
    const maxResults = req.maxResults ?? 200;
    const truncated = allMatches.length > maxResults;
    const matches = truncated ? allMatches.slice(0, maxResults) : allMatches;
    const filesMatched = new Set(matches.map((m) => m.filePath)).size;

    return {
      query: req.query,
      mode: req.mode,
      totalMatches: matches.length,
      filesMatched,
      elapsedMs: Date.now() - start,
      truncated,
      warnings: [],
      matches,
    };
  }

  private async runScaffoldCheck(req: SearchRequest, startTime: number): Promise<SearchResponse> {
    const warnings: string[] = [];
    const matches: SearchMatch[] = [];

    const requiredFiles = [
      "package.json",
      "tsconfig.json",
      ".env.example",
      "README.md",
    ];

    const fs = await import("fs/promises");
    for (const file of requiredFiles) {
      try {
        const fullPath = normalizePath(file, req.workspaceRoot);
        await fs.access(fullPath);
      } catch {
        matches.push({
          filePath: file,
          snippet: `Missing required file: ${file}`,
          matchType: "scaffold",
          searchMode: "scaffold",
          severity: "error",
          ruleId: "required-files",
        });
        warnings.push(`Missing required file: ${file}`);
      }
    }

    const envVars = ["NEXT_PUBLIC_API_URL", "SUPABASE_URL"];
    const envSearch = await runRg(
      ["--no-heading", "--count", "-e", envVars.join("|"), req.workspaceRoot],
      req.workspaceRoot,
    );

    for (const v of envVars) {
      if (!envSearch.stdout.includes(v)) {
        matches.push({
          filePath: ".env.example",
          snippet: `Missing required env var reference: ${v}`,
          matchType: "scaffold",
          searchMode: "scaffold",
          severity: "warning",
          ruleId: "required-envs",
        });
        warnings.push(`Missing required env var reference: ${v}`);
      }
    }

    const riskSearch = await runRg(
      ["--no-heading", "--line-number", "--column", "--color=never", "-e",
        "\\beval\\s*\\(|new\\s+Function\\s*\\(", req.workspaceRoot],
      req.workspaceRoot,
    );

    if (riskSearch.stdout.trim()) {
      const riskMatches = parseRgOutput(riskSearch.stdout, "risk");
      for (const m of riskMatches) {
        matches.push({
          ...m,
          matchType: "scaffold",
          searchMode: "scaffold",
          severity: "error",
          ruleId: "risk-patterns",
        });
      }
      warnings.push(`Found ${riskMatches.length} risky pattern(s)`);
    }

    const filesMatched = new Set(matches.map((m) => m.filePath)).size;

    return {
      mode: "scaffold",
      totalMatches: matches.length,
      filesMatched,
      elapsedMs: Date.now() - startTime,
      truncated: false,
      warnings,
      matches,
    };
  }
}
