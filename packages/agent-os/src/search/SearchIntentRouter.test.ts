import { describe, it, expect } from "vitest";
import {
  matchIntent,
  routeToSearchRequest,
  shouldRouteToSearch,
} from "./SearchIntentRouter.js";

describe("matchIntent", () => {
  it("returns null for empty input", () => {
    expect(matchIntent("")).toBeNull();
    expect(matchIntent("  ")).toBeNull();
  });

  it("returns null for unrecognized phrases", () => {
    expect(matchIntent("tell me a joke")).toBeNull();
    expect(matchIntent("deploy my contract")).toBeNull();
  });

  it("matches TODO search phrases", () => {
    const r1 = matchIntent("find all todos");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("todo");

    const r2 = matchIntent("show me FIXME items");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("todo");
  });

  it("extracts query from TODO phrase", () => {
    const r = matchIntent("find all todos about auth");
    expect(r).not.toBeNull();
    expect(r!.mode).toBe("todo");
    expect(r!.query).toBe("auth");
  });

  it("matches filename search phrases", () => {
    const r1 = matchIntent('find file named "config.ts"');
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("filename");
    expect(r1!.query).toBe("config.ts");

    const r2 = matchIntent("locate all files matching utils");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("filename");
  });

  it("matches symbol/grep phrases", () => {
    const r1 = matchIntent("grep for fetchData");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("symbol");
    expect(r1!.query).toBe("fetchData");

    const r2 = matchIntent("find all uses of AuthProvider");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("symbol");
  });

  it("matches env search phrases", () => {
    const r1 = matchIntent("find all env vars");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("env");

    const r2 = matchIntent("locate process.env usage");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("env");

    const r3 = matchIntent("show NEXT_PUBLIC_API_URL");
    expect(r3).not.toBeNull();
    expect(r3!.mode).toBe("env");
    expect(r3!.query).toBe("NEXT_PUBLIC_API_URL");
  });

  it("matches export search phrases", () => {
    const r = matchIntent("find all exports");
    expect(r).not.toBeNull();
    expect(r!.mode).toBe("export");
  });

  it("matches risk scan phrases", () => {
    const r1 = matchIntent("find risky patterns");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("risk");

    const r2 = matchIntent("security scan");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("risk");
  });

  it("matches scaffold verify phrases", () => {
    const r1 = matchIntent("verify scaffold");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("scaffold");

    const r2 = matchIntent("scaffold check");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("scaffold");
  });

  it("assigns higher confidence when query is extracted", () => {
    const withQuery = matchIntent("grep for fetchData");
    const withoutQuery = matchIntent("find all todos");
    expect(withQuery!.confidence).toBeGreaterThan(withoutQuery!.confidence);
  });
});

describe("routeToSearchRequest", () => {
  it("returns null for unrecognized input", () => {
    expect(routeToSearchRequest("hello world", "/repo")).toBeNull();
  });

  it("builds a valid SearchRequest for a TODO phrase", () => {
    const req = routeToSearchRequest("find all todos about auth", "/repo");
    expect(req).not.toBeNull();
    expect(req!.mode).toBe("todo");
    expect(req!.query).toBe("auth");
    expect(req!.workspaceRoot).toBe("/repo");
    expect(req!.maxResults).toBeGreaterThan(0);
  });

  it("applies overrides", () => {
    const req = routeToSearchRequest("find todos", "/repo", {
      maxResults: 50,
      caseSensitive: true,
    });
    expect(req).not.toBeNull();
    expect(req!.maxResults).toBe(50);
    expect(req!.caseSensitive).toBe(true);
  });
});

describe("shouldRouteToSearch", () => {
  it("returns true for search-like phrases", () => {
    expect(shouldRouteToSearch("find all todos")).toBe(true);
    expect(shouldRouteToSearch("grep for auth")).toBe(true);
  });

  it("returns false for non-search phrases", () => {
    expect(shouldRouteToSearch("deploy my contract")).toBe(false);
    expect(shouldRouteToSearch("what is TypeScript")).toBe(false);
  });
});
