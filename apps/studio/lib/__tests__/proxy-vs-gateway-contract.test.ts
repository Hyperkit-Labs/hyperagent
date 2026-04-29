/**
 * F-009 regression harness: Studio dev proxy vs api-gateway proxy contract.
 *
 * Ensures that:
 * 1. Every path in GATEWAY_PUBLIC_PATHS is NOT excluded by isExcludedFromStudioEdge —
 *    if the studio edge drops the request, it never reaches the gateway.
 * 2. Every /api/v1/ prefixed path is NOT excluded by isExcludedFromStudioEdge.
 * 3. Static assets ARE excluded by the studio edge (the inverse sanity check).
 *
 * Drift class: studio edge changes that accidentally block gateway-bound API
 * traffic. This is the same class that caused the KNOWN_PATH_PREFIXES regression
 * in PR #441.
 */
import { GATEWAY_PUBLIC_PATHS } from "@hyperagent/api-contracts";
import { isExcludedFromStudioEdge } from "../studio-proxy-config";

describe("proxy-vs-gateway contract (F-009)", () => {
  describe("GATEWAY_PUBLIC_PATHS must not be blocked by studio edge", () => {
    it.each(GATEWAY_PUBLIC_PATHS.map((p) => [p]))(
      "%s should reach the gateway (not excluded from studio edge)",
      (publicPath) => {
        expect(isExcludedFromStudioEdge(publicPath)).toBe(false);
      },
    );
  });

  describe("/api/v1/* paths must not be excluded by studio edge", () => {
    const apiPaths = [
      "/api/v1/health",
      "/api/v1/auth/bootstrap",
      "/api/v1/runs",
      "/api/v1/agent-registry/agents",
      "/api/v1/a2a/tasks",
      "/api/v1/erc8004/sync",
      "/api/v1/user-templates",
      "/api/v1/artifacts",
      "/api/v1/credits",
      "/api/v1/payments",
    ];

    it.each(apiPaths.map((p) => [p]))(
      "%s should reach the gateway (not excluded from studio edge)",
      (apiPath) => {
        expect(isExcludedFromStudioEdge(apiPath)).toBe(false);
      },
    );
  });

  describe("static assets ARE excluded from studio edge (inverse sanity)", () => {
    const statics = [
      "/favicon.ico",
      "/robots.txt",
      "/_next/static/chunks/main.js",
      "/_vercel/insights/view",
      "/icon.png",
      "/logo.svg",
      "/manifest.json",
    ];

    it.each(statics.map((p) => [p]))(
      "%s should be excluded (static asset, not api traffic)",
      (staticPath) => {
        expect(isExcludedFromStudioEdge(staticPath)).toBe(true);
      },
    );
  });

  describe("app HTML routes are not excluded", () => {
    const appRoutes = ["/", "/login", "/dashboard", "/contracts", "/runs"];

    it.each(appRoutes.map((p) => [p]))(
      "%s should not be excluded (app route, needs session/CSP middleware)",
      (appRoute) => {
        expect(isExcludedFromStudioEdge(appRoute)).toBe(false);
      },
    );
  });
});
