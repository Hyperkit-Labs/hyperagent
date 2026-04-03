import { describe, it, expect } from "vitest";
import {
  formatSearchResult,
  formatMatchAsOneliner,
  formatResponseAsText,
} from "./SearchResultFormatter.js";
import type { SearchResponse, SearchMatch } from "./types.js";

function makeMatch(overrides?: Partial<SearchMatch>): SearchMatch {
  return {
    filePath: "src/index.ts",
    line: 10,
    column: 5,
    snippet: "const x = 1;",
    matchType: "content",
    searchMode: "content",
    ...overrides,
  };
}

function makeResponse(overrides?: Partial<SearchResponse>): SearchResponse {
  return {
    mode: "content",
    query: "test",
    totalMatches: 2,
    filesMatched: 1,
    elapsedMs: 25,
    truncated: false,
    warnings: [],
    matches: [
      makeMatch({ line: 10 }),
      makeMatch({ line: 20, snippet: "const y = 2;" }),
    ],
    ...overrides,
  };
}

describe("formatSearchResult", () => {
  it("groups matches by file", () => {
    const result = formatSearchResult(makeResponse());
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].filePath).toBe("src/index.ts");
    expect(result.groups[0].matchCount).toBe(2);
  });

  it("sorts groups by match count (most first)", () => {
    const result = formatSearchResult(
      makeResponse({
        matches: [
          makeMatch({ filePath: "a.ts", line: 1 }),
          makeMatch({ filePath: "b.ts", line: 1 }),
          makeMatch({ filePath: "b.ts", line: 2 }),
        ],
      }),
    );
    expect(result.groups[0].filePath).toBe("b.ts");
    expect(result.groups[1].filePath).toBe("a.ts");
  });

  it("includes summary string", () => {
    const result = formatSearchResult(makeResponse());
    expect(result.summary).toContain("2 matches");
    expect(result.summary).toContain("1 file");
    expect(result.summary).toContain("25ms");
  });

  it("marks truncated in summary", () => {
    const result = formatSearchResult(makeResponse({ truncated: true }));
    expect(result.summary).toContain("truncated");
  });

  it("preserves warnings", () => {
    const result = formatSearchResult(makeResponse({ warnings: ["too many files"] }));
    expect(result.warnings).toContain("too many files");
  });
});

describe("formatMatchAsOneliner", () => {
  it("includes file path, line, and snippet", () => {
    const line = formatMatchAsOneliner(makeMatch());
    expect(line).toContain("src/index.ts");
    expect(line).toContain(":10:");
    expect(line).toContain("const x = 1;");
  });

  it("handles missing line number", () => {
    const line = formatMatchAsOneliner(makeMatch({ line: undefined, column: undefined }));
    expect(line).toBe("src/index.ts  const x = 1;");
  });
});

describe("formatResponseAsText", () => {
  it("produces markdown-ish text output", () => {
    const text = formatResponseAsText(makeResponse());
    expect(text).toContain("# Search: content");
    expect(text).toContain("src/index.ts");
  });

  it("includes warnings section when present", () => {
    const text = formatResponseAsText(makeResponse({ warnings: ["check this"] }));
    expect(text).toContain("## Warnings");
    expect(text).toContain("check this");
  });
});
