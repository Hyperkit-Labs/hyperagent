/**
 * Guards the pre-auth 404/probe short-circuit: paths that no gateway route will
 * ever handle (stray bot scans, misconfigured LLM base URLs such as
 * `/proxy/anthropic/v1/models`) must be classified as "unknown" so the gateway
 * can fail fast with 404 instead of surfacing noisy `401_invalid_token` warnings.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  KNOWN_PATH_PREFIXES,
  isKnownGatewayPath,
  isStaticProbePath,
} from "./knownPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

/**
 * Guards against silent drift: when a future PR adds a new top-level
 * `app.use(...)` / `app.get(...)` / `app.post(...)` mount in `index.ts` whose
 * top-level segment is not covered by any entry in `KNOWN_PATH_PREFIXES`, the
 * pre-auth guard would 404 the new route. Statically parse `index.ts` here
 * instead of importing it so we don't trigger Sentry/Otel init or `app.listen`.
 */
describe("KNOWN_PATH_PREFIXES vs index.ts mounts", () => {
  it("covers every top-level route mounted in index.ts", () => {
    const indexSrc = readFileSync(join(__dirname, "index.ts"), "utf8");
    // app.use("/foo", …), app.get("/foo", …), app.post("/foo", …)
    const mountRegex =
      /\bapp\.(?:use|get|post|put|patch|delete)\(\s*["'`](\/[^"'`?]+)/g;
    const found = new Set<string>();
    for (const match of indexSrc.matchAll(mountRegex)) {
      const fullPath = match[1];
      if (!fullPath || fullPath === "/") continue;
      found.add(fullPath);
    }
    expect(found.size).toBeGreaterThan(0);

    const uncovered: string[] = [];
    for (const mount of found) {
      if (!isKnownGatewayPath(mount)) uncovered.push(mount);
    }
    expect(
      uncovered,
      `index.ts mounts not covered by KNOWN_PATH_PREFIXES: ${uncovered.join(", ")}`,
    ).toEqual([]);
  });

  it("does not contain entries that overlap each other (e.g. /foo and /foo/bar)", () => {
    const overlaps: Array<[string, string]> = [];
    for (const a of KNOWN_PATH_PREFIXES) {
      for (const b of KNOWN_PATH_PREFIXES) {
        if (a === b) continue;
        if (b.startsWith(`${a}/`)) overlaps.push([a, b]);
      }
    }
    expect(
      overlaps,
      `redundant nested entries: ${overlaps.map(([a, b]) => `${b} ⊂ ${a}`).join(", ")}`,
    ).toEqual([]);
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
