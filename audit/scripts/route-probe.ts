/**
 * Route probe skeleton for WS10 runtime proof.
 *
 * Hits every entry under packages/api-contracts ApiPaths against the local
 * docker-compose stack and records per-route status. Designed to be run from
 * the repo root with the gateway on port 4000:
 *
 *   make up-local
 *   pnpm tsx audit/scripts/route-probe.ts > audit/08-runtime-proof/01-route-probe.json
 *
 * The stack is not started by this script; the script intentionally fails
 * loudly (exit code 2) when BASE_URL is unreachable so the audit cannot ship
 * silent runtime proof.
 *
 * Auth: when AUTH_JWT is set in the environment, every request includes
 * `Authorization: Bearer $AUTH_JWT`. Without it, only public paths
 * (GATEWAY_PUBLIC_PATHS) are exercised.
 */
import {
  ApiPaths,
  GATEWAY_PUBLIC_PATHS,
  GatewayLegacyMountPaths,
} from "@hyperagent/api-contracts";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4000";
const AUTH_JWT = process.env.AUTH_JWT ?? "";
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS ?? 5000);

interface ProbeResult {
  path: string;
  method: "GET";
  status: number | "ERROR";
  durationMs: number;
  bodyShape: "json" | "text" | "empty" | "unknown";
  error?: string;
}

function withParam(path: string): string {
  return path.replace(/\{[^}]+\}/g, "0");
}

async function probe(path: string): Promise<ProbeResult> {
  const url = `${BASE_URL}${withParam(path)}`;
  const headers: Record<string, string> = {};
  if (AUTH_JWT) headers["Authorization"] = `Bearer ${AUTH_JWT}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: ctrl.signal,
      redirect: "manual",
    });
    const durationMs = Math.round(performance.now() - start);
    const body = await res.text();
    let bodyShape: ProbeResult["bodyShape"] = "empty";
    if (body.length > 0) {
      try {
        JSON.parse(body);
        bodyShape = "json";
      } catch {
        bodyShape = "text";
      }
    }
    return {
      path,
      method: "GET",
      status: res.status,
      durationMs,
      bodyShape,
    };
  } catch (err) {
    return {
      path,
      method: "GET",
      status: "ERROR",
      durationMs: Math.round(performance.now() - start),
      bodyShape: "unknown",
      error: String(err instanceof Error ? err.message : err),
    };
  } finally {
    clearTimeout(t);
  }
}

async function main(): Promise<void> {
  // Sanity: gateway must be reachable.
  try {
    const res = await fetch(`${BASE_URL}${ApiPaths.healthLive}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (err) {
    console.error(
      `[route-probe] gateway not reachable at ${BASE_URL}: ${String(err instanceof Error ? err.message : err)}\n` +
        `Run \`make up-local\` (or set BASE_URL=...) and retry.`,
    );
    process.exit(2);
  }

  const seen = new Set<string>();
  const probePaths: string[] = [];
  for (const v of Object.values(ApiPaths)) {
    if (typeof v === "string" && !seen.has(v)) {
      seen.add(v);
      probePaths.push(v);
    }
  }
  for (const v of Object.values(GatewayLegacyMountPaths)) {
    if (typeof v === "string" && !seen.has(v)) {
      seen.add(v);
      probePaths.push(v);
    }
  }

  const results: ProbeResult[] = [];
  for (const p of probePaths) {
    results.push(await probe(p));
  }

  const summary = {
    base_url: BASE_URL,
    has_auth: Boolean(AUTH_JWT),
    public_paths: GATEWAY_PUBLIC_PATHS,
    probed: results.length,
    by_status: results.reduce<Record<string, number>>((acc, r) => {
      const k = String(r.status);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
    not_2xx_or_4xx_or_404: results
      .filter(
        (r) =>
          typeof r.status === "number" &&
          (r.status < 200 || r.status >= 600),
      )
      .map((r) => `${r.path} → ${r.status}`),
  };

  process.stdout.write(
    JSON.stringify({ summary, results }, null, 2) + "\n",
  );
}

await main();
