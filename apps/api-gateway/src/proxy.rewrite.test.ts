import { describe, expect, it } from "vitest";
import {
  isTimeoutLikeProxyError,
  normalizeProxyErrorResponse,
  rewriteMountToUpstreamPath,
} from "./proxy.js";

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

describe("normalizeProxyErrorResponse", () => {
  it("normalizes upstream validation errors into a stable envelope", () => {
    expect(
      normalizeProxyErrorResponse(
        422,
        "req-123",
        JSON.stringify({ detail: [{ msg: "limit must be <= 100" }] }),
      ),
    ).toEqual({
      error: "Unprocessable Entity",
      code: "request.validation_failed",
      message: "limit must be <= 100",
      requestId: "req-123",
      retryable: false,
      status: 422,
    });
  });

  it("does not leak raw upstream 5xx bodies", () => {
    expect(
      normalizeProxyErrorResponse(
        503,
        "req-456",
        JSON.stringify({ detail: "postgres password=secret exploded" }),
      ),
    ).toEqual({
      error: "Service Unavailable",
      code: "upstream.unavailable",
      message: "Backend unavailable. Try again shortly.",
      requestId: "req-456",
      retryable: true,
      status: 503,
    });
  });
});

describe("isTimeoutLikeProxyError", () => {
  it("detects timeout-class proxy failures", () => {
    const err = new Error("socket timed out") as Error & { code?: string };
    err.code = "ETIMEDOUT";
    expect(isTimeoutLikeProxyError(err)).toBe(true);
    expect(isTimeoutLikeProxyError(new Error("other transport failure"))).toBe(
      false,
    );
  });
});
