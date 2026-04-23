/**
 * Guards the pre-auth 404/probe short-circuit: paths that no gateway route will
 * ever handle (stray bot scans, misconfigured LLM base URLs such as
 * `/proxy/anthropic/v1/models`) must be classified as "unknown" so the gateway
 * can fail fast with 404 instead of surfacing noisy `401_invalid_token` warnings.
 */
import { describe, expect, it } from "vitest";
import { isKnownGatewayPath, isStaticProbePath } from "./knownPaths.js";

describe("isKnownGatewayPath", () => {
  it.each([
    "/",
    "/health",
    "/health/signin",
    "/health/live",
    "/api/v1/workflows",
    "/api/v1/byok/validate",
    "/config",
    "/platform/track-record",
    "/workspaces/current/llm-keys",
    "/openapi.json",
    "/docs",
    "/runs/abc",
  ])("recognizes %s as a mounted route", (path) => {
    expect(isKnownGatewayPath(path)).toBe(true);
  });

  it.each([
    "/proxy/anthropic/v1/models",
    "/proxy/openai/v1/chat/completions",
    "/admin",
    "/wp-admin",
    "/phpmyadmin",
    "/.env",
    "/v1/models",
  ])("rejects %s as unknown", (path) => {
    expect(isKnownGatewayPath(path)).toBe(false);
  });

  it("does not match partial prefixes that share a leading substring", () => {
    expect(isKnownGatewayPath("/apis")).toBe(false);
    expect(isKnownGatewayPath("/health-check")).toBe(false);
  });
});

describe("isStaticProbePath", () => {
  it("matches browser and crawler probes", () => {
    expect(isStaticProbePath("/favicon.ico")).toBe(true);
    expect(isStaticProbePath("/robots.txt")).toBe(true);
    expect(isStaticProbePath("/sitemap.xml")).toBe(true);
  });

  it("does not match arbitrary paths", () => {
    expect(isStaticProbePath("/proxy/anthropic/v1/models")).toBe(false);
    expect(isStaticProbePath("/api/v1/health")).toBe(false);
  });
});
