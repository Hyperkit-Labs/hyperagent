/**
 * Known top-level route prefixes mounted by this gateway (see `index.ts`).
 * A pre-auth guard uses this list to fail fast on unknown paths with a 404
 * instead of routing them through auth and emitting `401_invalid_token`
 * warnings for bots, misconfigured LLM clients, or stray proxy probes.
 *
 * Keep in sync with the `app.use(...)` / `app.get(...)` mounts in `index.ts`.
 * The `KNOWN_PATH_PREFIXES vs index.ts mounts` test in `knownPaths.test.ts`
 * statically parses `index.ts` and fails this list ever drifts out of sync.
 */
export const KNOWN_PATH_PREFIXES = [
  "/health",
  "/auth/bootstrap",
  "/api",
  "/run",
  "/runs",
  "/docs",
  "/openapi.json",
  "/config",
  "/platform/track-record",
  "/workspaces",
  "/workflows",
  "/agent-registry",
  "/a2a",
  "/erc8004",
  "/user-templates",
  "/artifacts",
  "/streaming",
  "/presets",
  "/blueprints",
  "/templates",
  "/networks",
  "/agents",
  "/contracts",
  "/logs",
  "/metrics",
  "/security",
  "/pricing",
  "/tokens",
  "/infra",
  "/quick-demo",
] as const;

/** Paths that browsers or crawlers request unconditionally. Always served pre-auth. */
export const STATIC_PROBE_PATHS = new Set<string>([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function normalize(input: string): string {
  const noQuery = (input || "").split("?")[0];
  const collapsed = noQuery.replace(/\/+/g, "/");
  const trimmed = collapsed !== "/" ? collapsed.replace(/\/$/, "") : collapsed;
  return trimmed || "/";
}

/** True if `pathname` equals or is nested under any known mount prefix. */
export function isKnownGatewayPath(pathname: string): boolean {
  const p = normalize(pathname);
  if (p === "/") return true;
  return KNOWN_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

/** True if `pathname` is a static browser/crawler probe (favicon, robots.txt, …). */
export function isStaticProbePath(pathname: string): boolean {
  return STATIC_PROBE_PATHS.has(normalize(pathname));
}
