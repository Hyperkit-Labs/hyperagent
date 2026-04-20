import { describe, expect, it } from "vitest";
import { rewriteMountToUpstreamPath } from "./proxy.js";

describe("rewriteMountToUpstreamPath", () => {
  it("restores /api/v1 prefix after strip mount", () => {
    expect(rewriteMountToUpstreamPath("/config", "/api/v1")).toBe("/api/v1/config");
    expect(rewriteMountToUpstreamPath("/workflows", "/api/v1")).toBe(
      "/api/v1/workflows",
    );
    expect(rewriteMountToUpstreamPath("/workflows/generate", "/api/v1")).toBe(
      "/api/v1/workflows/generate",
    );
  });

  it("preserves query string", () => {
    expect(rewriteMountToUpstreamPath("/config?x=1", "/api/v1")).toBe(
      "/api/v1/config?x=1",
    );
  });

  it("handles mount-only path", () => {
    expect(rewriteMountToUpstreamPath("/", "/api/v1")).toBe("/api/v1");
    expect(rewriteMountToUpstreamPath("", "/api/v1")).toBe("/api/v1");
    expect(rewriteMountToUpstreamPath("/?foo=bar", "/openapi.json")).toBe(
      "/openapi.json?foo=bar",
    );
  });

  it("maps /runs strip mount to orchestrator runs router", () => {
    expect(rewriteMountToUpstreamPath("/abc/steps", "/api/v1/runs")).toBe(
      "/api/v1/runs/abc/steps",
    );
  });

  it("trims trailing slash on prefix only", () => {
    expect(rewriteMountToUpstreamPath("/x", "/api/v1/")).toBe("/api/v1/x");
  });
});
