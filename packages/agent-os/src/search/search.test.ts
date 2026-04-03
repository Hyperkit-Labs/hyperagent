import { describe, it, expect } from "vitest";
import { validateSearchRequest } from "./SearchSafetyValidator.js";
import { _buildArgs_for_testing as buildArgs } from "./RipgrepAdapter.js";
import type { SearchRequest } from "./types.js";
import { SEARCH_MODES, DEFAULT_MAX_RESULTS, MAX_QUERY_LENGTH } from "./types.js";

// ---------------------------------------------------------------------------
// SearchSafetyValidator
// ---------------------------------------------------------------------------

describe("validateSearchRequest", () => {
  const validBase: SearchRequest = {
    mode: "content",
    query: "hello",
    workspaceRoot: "/repo",
  };

  it("accepts a valid content search", () => {
    const errors = validateSearchRequest(validBase);
    expect(errors).toHaveLength(0);
  });

  it("rejects missing workspaceRoot", () => {
    const errors = validateSearchRequest({ mode: "content", query: "hi" });
    expect(errors.some((e) => e.field === "workspaceRoot")).toBe(true);
  });

  it("rejects invalid mode", () => {
    const errors = validateSearchRequest({
      ...validBase,
      mode: "bad" as any,
    });
    expect(errors.some((e) => e.field === "mode")).toBe(true);
  });

  it("rejects query with shell metacharacters", () => {
    const errors = validateSearchRequest({
      ...validBase,
      query: "hello; rm -rf",
    });
    expect(errors.some((e) => e.field === "query")).toBe(true);
  });

  it("rejects query with pipe", () => {
    const errors = validateSearchRequest({
      ...validBase,
      query: "hello | cat",
    });
    expect(errors.some((e) => e.field === "query")).toBe(true);
  });

  it("rejects query exceeding max length", () => {
    const errors = validateSearchRequest({
      ...validBase,
      query: "a".repeat(MAX_QUERY_LENGTH + 1),
    });
    expect(errors.some((e) => e.field === "query")).toBe(true);
  });

  it("rejects path traversal in query", () => {
    const errors = validateSearchRequest({
      ...validBase,
      query: "../../etc/passwd",
    });
    expect(errors.some((e) => e.field === "query")).toBe(true);
  });

  it("rejects invalid regex syntax", () => {
    const errors = validateSearchRequest({
      ...validBase,
      regex: "[invalid(",
    });
    expect(errors.some((e) => e.field === "regex")).toBe(true);
  });

  it("rejects regex DoS patterns", () => {
    const errors = validateSearchRequest({
      ...validBase,
      regex: "a]((((((a",
    });
    // The regex itself is syntactically invalid, so it should be caught
    expect(errors.some((e) => e.field === "regex")).toBe(true);
  });

  it("rejects paths that escape workspace", () => {
    const errors = validateSearchRequest({
      ...validBase,
      paths: ["/etc/passwd"],
    });
    expect(errors.some((e) => e.field === "paths")).toBe(true);
  });

  it("accepts paths within workspace", () => {
    const errors = validateSearchRequest({
      ...validBase,
      paths: ["/repo/src/index.ts"],
      workspaceRoot: "/repo",
    });
    expect(errors.filter((e) => e.field === "paths")).toHaveLength(0);
  });

  it("rejects globs with path traversal", () => {
    const errors = validateSearchRequest({
      ...validBase,
      includeGlobs: ["../../**/*.ts"],
    });
    expect(errors.some((e) => e.field === "includeGlobs")).toBe(true);
  });

  it("rejects negative maxResults", () => {
    const errors = validateSearchRequest({
      ...validBase,
      maxResults: -1,
    });
    expect(errors.some((e) => e.field === "maxResults")).toBe(true);
  });

  it("accepts all valid search modes", () => {
    for (const mode of SEARCH_MODES) {
      const errors = validateSearchRequest({
        mode,
        workspaceRoot: "/repo",
        query: "test",
      });
      expect(errors.filter((e) => e.field === "mode")).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// RipgrepAdapter - buildArgs
// ---------------------------------------------------------------------------

describe("buildArgs", () => {
  const base: SearchRequest = {
    mode: "content",
    query: "hello",
    workspaceRoot: "/repo",
  };

  it("builds content search args", () => {
    const args = buildArgs(base);
    expect(args).toContain("-n");
    expect(args).toContain("--column");
    expect(args).toContain("-e");
    expect(args).toContain("hello");
    expect(args).toContain("--");
    expect(args).toContain("/repo");
  });

  it("builds filename search args", () => {
    const args = buildArgs({ ...base, mode: "filename" });
    expect(args).toContain("--files");
  });

  it("builds todo search args", () => {
    const args = buildArgs({ ...base, mode: "todo" });
    const pattern = args[args.indexOf("-e") + 1];
    expect(pattern).toContain("TODO");
    expect(pattern).toContain("FIXME");
  });

  it("builds env search args", () => {
    const args = buildArgs({ ...base, mode: "env", query: undefined });
    const pattern = args[args.indexOf("-e") + 1];
    expect(pattern).toContain("process\\.env");
  });

  it("builds symbol search with -w flag", () => {
    const args = buildArgs({ ...base, mode: "symbol" });
    expect(args).toContain("-w");
  });

  it("adds case sensitive flag", () => {
    const args = buildArgs({ ...base, caseSensitive: true });
    expect(args).toContain("-s");
    expect(args).not.toContain("-i");
  });

  it("adds case insensitive flag by default", () => {
    const args = buildArgs({ ...base, caseSensitive: false });
    expect(args).toContain("-i");
  });

  it("adds whole word flag", () => {
    const args = buildArgs({ ...base, wholeWord: true });
    expect(args).toContain("-w");
  });

  it("adds include globs", () => {
    const args = buildArgs({ ...base, includeGlobs: ["*.ts", "*.tsx"] });
    const globIdx = args.indexOf("--glob");
    expect(globIdx).not.toBe(-1);
    expect(args[globIdx + 1]).toBe("*.ts");
  });

  it("adds exclude globs with negation", () => {
    const args = buildArgs({ ...base, excludeGlobs: ["node_modules"] });
    const globIndices = args
      .map((a, i) => (a === "--glob" ? i : -1))
      .filter((i) => i !== -1);
    const hasNegated = globIndices.some((i) => args[i + 1] === "!node_modules");
    expect(hasNegated).toBe(true);
  });

  it("respects custom paths", () => {
    const args = buildArgs({ ...base, paths: ["/repo/src"] });
    expect(args).toContain("/repo/src");
    expect(args).not.toContain("/repo");
  });

  it("adds --no-hidden by default", () => {
    const args = buildArgs(base);
    expect(args).toContain("--no-hidden");
  });

  it("omits --no-hidden when includeHidden is true", () => {
    const args = buildArgs({ ...base, includeHidden: true });
    expect(args).not.toContain("--no-hidden");
  });

  it("adds --no-ignore when includeIgnored is true", () => {
    const args = buildArgs({ ...base, includeIgnored: true });
    expect(args).toContain("--no-ignore");
  });

  it("uses regex when provided", () => {
    const args = buildArgs({ ...base, query: undefined, regex: "foo\\d+" });
    expect(args).toContain("foo\\d+");
  });

  it("builds risk search args", () => {
    const args = buildArgs({ ...base, mode: "risk", query: undefined });
    const pattern = args[args.indexOf("-e") + 1];
    expect(pattern).toContain("eval\\(");
    expect(pattern).toContain("innerHTML");
  });
});

// ---------------------------------------------------------------------------
// Types - constants
// ---------------------------------------------------------------------------

describe("search types constants", () => {
  it("DEFAULT_MAX_RESULTS is a reasonable number", () => {
    expect(DEFAULT_MAX_RESULTS).toBeGreaterThan(0);
    expect(DEFAULT_MAX_RESULTS).toBeLessThanOrEqual(1000);
  });

  it("SEARCH_MODES contains expected modes", () => {
    expect(SEARCH_MODES).toContain("content");
    expect(SEARCH_MODES).toContain("filename");
    expect(SEARCH_MODES).toContain("todo");
    expect(SEARCH_MODES).toContain("risk");
    expect(SEARCH_MODES).toContain("scaffold");
  });
});
