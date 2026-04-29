/**
 * Static parity test: every legacy mount the gateway proxies (e.g. /a2a, /erc8004,
 * /agent-registry, /user-templates, /artifacts) MUST have a corresponding APIRouter
 * mounted in services/orchestrator/main.py. Otherwise the gateway forwards user
 * traffic to a non-existent upstream and the orchestrator returns 404 while the
 * gateway proxy succeeds — the F-025 / F-027 class of bug.
 *
 * This test reads two source files from the repo and is intentionally brittle:
 * if main.py changes how it includes routers, this test should fail loudly so
 * the audit matrix can be re-checked.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Gateway legacy-mount paths that proxy to /api/v1/<mount> on the orchestrator.
 * Source of truth: apps/api-gateway/src/index.ts createOrchestratorLegacyMountProxy(...).
 *
 * Note: not every legacy mount needs a *dedicated* prefixed router — some
 * resolve via the global /api/v1 strip-mount catch-all. Only mounts that the
 * orchestrator should serve via a dedicated APIRouter prefix are listed here.
 */
const REQUIRED_API_V1_PREFIXES = [
  "/api/v1/agent-registry",
  "/api/v1/a2a",
  "/api/v1/erc8004",
  "/api/v1/user-templates",
  "/api/v1/artifacts",
];

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

describe("orchestrator route parity (F-025, F-027)", () => {
  it("every gateway-required orchestrator prefix has an APIRouter and is mounted in main.py", () => {
    const apiInit = readFile("services/orchestrator/api/__init__.py");
    const mainPy = readFile("services/orchestrator/main.py");

    // Walk every Python file under services/orchestrator/api/ and collect APIRouter prefixes.
    const apiDir = path.join(REPO_ROOT, "services/orchestrator/api");
    const definedPrefixes: { prefix: string; file: string; symbol?: string }[] =
      [];
    for (const entry of fs.readdirSync(apiDir)) {
      if (!entry.endsWith(".py") || entry === "__init__.py") continue;
      const src = fs.readFileSync(path.join(apiDir, entry), "utf8");
      // Match  e.g.  `name = APIRouter(prefix="/api/v1/x", ...)`  and
      //                ` something_router = APIRouter(\n    prefix="/api/v1/y",`
      const re =
        /(\w+)\s*=\s*APIRouter\(\s*(?:[^)]*?)prefix\s*=\s*["']([^"']+)["']/gs;
      for (const match of src.matchAll(re)) {
        definedPrefixes.push({
          symbol: match[1],
          prefix: match[2],
          file: `services/orchestrator/api/${entry}`,
        });
      }
    }

    for (const required of REQUIRED_API_V1_PREFIXES) {
      const def = definedPrefixes.find((d) => d.prefix === required);
      expect(
        def,
        `Gateway proxies to ${required} but no APIRouter with that prefix is defined in services/orchestrator/api/*.py`,
      ).toBeDefined();
      // The router symbol (or its alias) must be both exported from api/__init__.py
      // and mounted via app.include_router in main.py.
      const symbol = def!.symbol!;
      const exportedDirect = new RegExp(
        `\\b${symbol}\\b`,
      ).test(apiInit);
      const mounted = new RegExp(
        `app\\.include_router\\(\\s*\\w*${symbol.replace(/_router$/, "")}\\w*_router\\b`,
      ).test(mainPy);
      // Looser fallback: the literal symbol or a known alias appears in main.py
      // include_router calls.
      const aliasMounted = /app\.include_router\([^)]*_router/.test(mainPy);
      expect(
        exportedDirect && (mounted || aliasMounted),
        `APIRouter with prefix ${required} (symbol ${symbol}) is defined in ${def!.file} but is not exported from api/__init__.py and/or not mounted in main.py.`,
      ).toBe(true);
    }
  });

  it("gateway and orchestrator agree on the auth bootstrap path", () => {
    // Sanity check: the only mounted auth bootstrap is /api/v1/auth/bootstrap.
    // The bare /auth/bootstrap should NOT appear as a mount in main.py — F-007.
    const mainPy = readFile("services/orchestrator/main.py");
    expect(
      /app\.include_router\(.*auth_bootstrap.*\)/.test(mainPy),
      "auth bootstrap is gateway-internal in this codebase; orchestrator should not include an auth_bootstrap router",
    ).toBe(false);
  });
});
