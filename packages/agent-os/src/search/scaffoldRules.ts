/**
 * scaffoldRules: configurable scaffold verification rules.
 *
 * Scaffold verification is a composite mode that checks:
 *   - required file existence
 *   - required exports from barrel files
 *   - required env var references
 *   - risky/unsafe pattern scans
 *
 * Returns missing items explicitly so the agent or developer
 * knows exactly what the scaffold still needs.
 */

import type { SearchMatch, SearchMode, SearchResponse } from "./types.js";

export interface ScaffoldRule {
  readonly id: string;
  readonly category: "required-files" | "required-exports" | "required-envs" | "risk-patterns";
  readonly description: string;
}

export interface FileExistenceRule extends ScaffoldRule {
  readonly category: "required-files";
  readonly paths: readonly string[];
}

export interface ExportRule extends ScaffoldRule {
  readonly category: "required-exports";
  readonly file: string;
  readonly exports: readonly string[];
}

export interface EnvRule extends ScaffoldRule {
  readonly category: "required-envs";
  readonly vars: readonly string[];
}

export interface RiskPatternRule extends ScaffoldRule {
  readonly category: "risk-patterns";
  readonly patterns: readonly string[];
  readonly severity: "info" | "warning" | "error";
}

export type AnyScaffoldRule = FileExistenceRule | ExportRule | EnvRule | RiskPatternRule;

export const DEFAULT_SCAFFOLD_RULES: readonly AnyScaffoldRule[] = [
  {
    id: "core-config-files",
    category: "required-files",
    description: "Core config files must exist",
    paths: [
      "package.json",
      "tsconfig.json",
      ".env.example",
      "README.md",
    ],
  },
  {
    id: "agent-os-barrel",
    category: "required-exports",
    description: "agent-os package barrel must re-export search",
    file: "packages/agent-os/src/index.ts",
    exports: [
      "WorkspaceSearchService",
      "SearchRequest",
      "SearchResponse",
      "SearchMatch",
      "SearchMode",
    ],
  },
  {
    id: "core-env-vars",
    category: "required-envs",
    description: "Critical env vars must be referenced somewhere",
    vars: [
      "NEXT_PUBLIC_API_URL",
      "SUPABASE_URL",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
  },
  {
    id: "unsafe-eval-usage",
    category: "risk-patterns",
    description: "eval() and Function() constructor should not appear",
    patterns: ["\\beval\\s*\\(", "new\\s+Function\\s*\\("],
    severity: "error",
  },
  {
    id: "console-log-leak",
    category: "risk-patterns",
    description: "console.log in production code",
    patterns: ["\\bconsole\\.log\\b"],
    severity: "warning",
  },
];

export interface ScaffoldCheckResult {
  readonly rule: AnyScaffoldRule;
  readonly passed: boolean;
  readonly missing: readonly string[];
}

export function buildFileExistenceChecks(
  rule: FileExistenceRule,
  existingFiles: ReadonlySet<string>,
): ScaffoldCheckResult {
  const missing = rule.paths.filter((p) => !existingFiles.has(p));
  return { rule, passed: missing.length === 0, missing };
}

export function buildExportChecks(
  rule: ExportRule,
  fileContent: string | null,
): ScaffoldCheckResult {
  if (fileContent === null) {
    return { rule, passed: false, missing: [rule.file] };
  }
  const missing = rule.exports.filter((exp) => {
    const re = new RegExp(`\\b${exp}\\b`);
    return !re.test(fileContent);
  });
  return { rule, passed: missing.length === 0, missing };
}

export function buildEnvChecks(
  rule: EnvRule,
  allContent: string,
): ScaffoldCheckResult {
  const missing = rule.vars.filter((v) => !allContent.includes(v));
  return { rule, passed: missing.length === 0, missing };
}

export function scaffoldCheckResultToMatches(
  result: ScaffoldCheckResult,
): SearchMatch[] {
  if (result.passed) return [];

  return result.missing.map((item) => ({
    filePath: "file" in result.rule ? (result.rule as ExportRule).file : item,
    snippet: `Missing ${result.rule.category.replace("required-", "")}: ${item}`,
    matchType: "scaffold" as SearchMode,
    searchMode: "scaffold" as SearchMode,
    ruleId: result.rule.id,
    severity:
      result.rule.category === "risk-patterns"
        ? (result.rule as RiskPatternRule).severity
        : "error",
  }));
}

export function mergeScaffoldResults(
  checks: readonly ScaffoldCheckResult[],
  elapsedMs: number,
): SearchResponse {
  const allMatches: SearchMatch[] = [];
  const warnings: string[] = [];

  for (const check of checks) {
    const matches = scaffoldCheckResultToMatches(check);
    allMatches.push(...matches);
    if (!check.passed) {
      warnings.push(
        `[${check.rule.id}] ${check.rule.description}: missing ${check.missing.join(", ")}`,
      );
    }
  }

  const filesMatched = new Set(allMatches.map((m) => m.filePath)).size;

  return {
    mode: "scaffold",
    totalMatches: allMatches.length,
    filesMatched,
    elapsedMs,
    truncated: false,
    warnings,
    matches: allMatches,
  };
}

export function getRulesForCategories(
  categories: readonly string[],
  allRules: readonly AnyScaffoldRule[] = DEFAULT_SCAFFOLD_RULES,
): AnyScaffoldRule[] {
  if (categories.length === 0) return [...allRules];
  return allRules.filter((r) => categories.includes(r.category) || categories.includes(r.id));
}
