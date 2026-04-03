import { describe, it, expect } from "vitest";
import {
  buildFileExistenceChecks,
  buildExportChecks,
  buildEnvChecks,
  scaffoldCheckResultToMatches,
  mergeScaffoldResults,
  getRulesForCategories,
  DEFAULT_SCAFFOLD_RULES,
} from "./scaffoldRules.js";
import type { FileExistenceRule, ExportRule, EnvRule } from "./scaffoldRules.js";

describe("buildFileExistenceChecks", () => {
  const rule: FileExistenceRule = {
    id: "test-files",
    category: "required-files",
    description: "Test files",
    paths: ["package.json", "README.md", "tsconfig.json"],
  };

  it("passes when all files exist", () => {
    const existing = new Set(["package.json", "README.md", "tsconfig.json"]);
    const result = buildFileExistenceChecks(rule, existing);
    expect(result.passed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("fails with missing files", () => {
    const existing = new Set(["package.json"]);
    const result = buildFileExistenceChecks(rule, existing);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("README.md");
    expect(result.missing).toContain("tsconfig.json");
  });

  it("fails when set is empty", () => {
    const result = buildFileExistenceChecks(rule, new Set());
    expect(result.passed).toBe(false);
    expect(result.missing).toHaveLength(3);
  });
});

describe("buildExportChecks", () => {
  const rule: ExportRule = {
    id: "test-exports",
    category: "required-exports",
    description: "Test exports",
    file: "src/index.ts",
    exports: ["SearchRequest", "SearchResponse"],
  };

  it("passes when all exports are present", () => {
    const content = 'export type { SearchRequest, SearchResponse } from "./types";';
    const result = buildExportChecks(rule, content);
    expect(result.passed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("fails when an export is missing", () => {
    const content = 'export type { SearchRequest } from "./types";';
    const result = buildExportChecks(rule, content);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("SearchResponse");
  });

  it("fails when file content is null", () => {
    const result = buildExportChecks(rule, null);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("src/index.ts");
  });
});

describe("buildEnvChecks", () => {
  const rule: EnvRule = {
    id: "test-envs",
    category: "required-envs",
    description: "Test env vars",
    vars: ["NEXT_PUBLIC_API_URL", "SUPABASE_URL"],
  };

  it("passes when all vars are referenced", () => {
    const content = "NEXT_PUBLIC_API_URL=http://...\nSUPABASE_URL=http://...";
    const result = buildEnvChecks(rule, content);
    expect(result.passed).toBe(true);
  });

  it("fails when a var is missing", () => {
    const result = buildEnvChecks(rule, "NEXT_PUBLIC_API_URL=http://...");
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("SUPABASE_URL");
  });
});

describe("scaffoldCheckResultToMatches", () => {
  it("returns empty array for passing checks", () => {
    const matches = scaffoldCheckResultToMatches({
      rule: DEFAULT_SCAFFOLD_RULES[0],
      passed: true,
      missing: [],
    });
    expect(matches).toHaveLength(0);
  });

  it("returns matches for failing checks", () => {
    const fileRule = DEFAULT_SCAFFOLD_RULES[0];
    const matches = scaffoldCheckResultToMatches({
      rule: fileRule,
      passed: false,
      missing: ["README.md"],
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].searchMode).toBe("scaffold");
    expect(matches[0].snippet).toContain("README.md");
  });
});

describe("mergeScaffoldResults", () => {
  it("produces a valid SearchResponse", () => {
    const result = mergeScaffoldResults([], 42);
    expect(result.mode).toBe("scaffold");
    expect(result.elapsedMs).toBe(42);
    expect(result.totalMatches).toBe(0);
  });

  it("aggregates warnings from failed checks", () => {
    const result = mergeScaffoldResults(
      [
        {
          rule: DEFAULT_SCAFFOLD_RULES[0],
          passed: false,
          missing: ["README.md"],
        },
      ],
      10,
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.totalMatches).toBe(1);
  });
});

describe("getRulesForCategories", () => {
  it("returns all rules when categories is empty", () => {
    const rules = getRulesForCategories([]);
    expect(rules.length).toBe(DEFAULT_SCAFFOLD_RULES.length);
  });

  it("filters by category", () => {
    const rules = getRulesForCategories(["required-files"]);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.category === "required-files")).toBe(true);
  });

  it("filters by rule id", () => {
    const rules = getRulesForCategories(["unsafe-eval-usage"]);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("unsafe-eval-usage");
  });
});
