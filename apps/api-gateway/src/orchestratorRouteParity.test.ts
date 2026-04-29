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

    // Walk every Python file under services/orchestrator/api/ and collect
    // APIRouter prefixes -> defining module + symbol.
    const apiDir = path.join(REPO_ROOT, "services/orchestrator/api");
    const definedPrefixes: {
      prefix: string;
      file: string;
      module: string;
      symbol: string;
    }[] = [];
    for (const entry of fs.readdirSync(apiDir)) {
      if (!entry.endsWith(".py") || entry === "__init__.py") continue;
      const src = fs.readFileSync(path.join(apiDir, entry), "utf8");
      const re =
        /(\w+)\s*=\s*APIRouter\(\s*(?:[^)]*?)prefix\s*=\s*["']([^"']+)["']/gs;
      for (const match of src.matchAll(re)) {
        definedPrefixes.push({
          symbol: match[1],
          prefix: match[2],
          file: `services/orchestrator/api/${entry}`,
          module: entry.replace(/\.py$/, ""),
        });
      }
    }

    // Resolve every alias `from .<module> import <symbol> as <alias>` and the
    // direct form `from .<module> import <symbol>` in api/__init__.py.
    // alias for a (module, symbol) pair = the alias if present, else the symbol.
    function resolveExportName(module: string, symbol: string): string | null {
      const lines = apiInit.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const fromRe = new RegExp(
          `^from\\s+\\.${module}\\s+import\\s+(.+?)\\s*$`,
        );
        const fromMatch = ln.match(fromRe);
        if (!fromMatch) continue;
        // Collect import items, including parenthesised multi-line forms.
        let body = fromMatch[1];
        if (body.startsWith("(")) {
          let depth = body.split("(").length - body.split(")").length;
          let j = i + 1;
          while (depth > 0 && j < lines.length) {
            body += " " + lines[j];
            depth +=
              lines[j].split("(").length -
              1 -
              (lines[j].split(")").length - 1);
            j++;
          }
          body = body.replace(/[()]/g, "");
        }
        const items = body.split(",").map((s) => s.trim()).filter(Boolean);
        for (const item of items) {
          const asMatch = item.match(/^(\w+)\s+as\s+(\w+)$/);
          if (asMatch && asMatch[1] === symbol) return asMatch[2];
          if (item === symbol) return symbol;
        }
      }
      return null;
    }

    // All include_router(...) call bodies in main.py, ignoring comment lines.
    const mainPyNoComments = mainPy
      .split("\n")
      .filter((ln) => !/^\s*#/.test(ln))
      .join("\n");
    const includeRouterCalls = mainPyNoComments
      .split("app.include_router(")
      .slice(1)
      .map((s) => s.split(")")[0]);

    for (const required of REQUIRED_API_V1_PREFIXES) {
      const def = definedPrefixes.find((d) => d.prefix === required);
      expect(
        def,
        `Gateway proxies to ${required} but no APIRouter with that prefix is defined in services/orchestrator/api/*.py`,
      ).toBeDefined();
      const exportName = resolveExportName(def!.module, def!.symbol);
      expect(
        exportName,
        `APIRouter with prefix ${required} (defined as ${def!.symbol} in ${def!.file}) is not re-exported from services/orchestrator/api/__init__.py`,
      ).not.toBeNull();
      // The exported alias must appear inside an `app.include_router(<alias>)` call in main.py.
      const mounted = includeRouterCalls.some((body) =>
        new RegExp(`\\b${exportName!}\\b`).test(body),
      );
      expect(
        mounted,
        `APIRouter with prefix ${required} is exported as ${exportName} but is not mounted via app.include_router(${exportName}) in services/orchestrator/main.py`,
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
