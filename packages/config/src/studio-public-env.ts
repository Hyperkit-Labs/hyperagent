/**
 * Canonical Studio public env resolution: same inputs as root `.env` / Next `env` injection.
 * Used by the Next.js Edge proxy and by `apps/studio` runtime so CSP connect-src and fetch base URL
 * cannot drift.
 */
import { Env } from "./keys.js";

/** Default gateway when NEXT_PUBLIC_API_URL is unset (non-production); aligns with apps/studio/next.config.ts `env`. */
export const STUDIO_DEV_GATEWAY_ORIGIN_DEFAULT = "http://localhost:4000";

/** Resolved backend API base path `/api/v1` for local gateway in development. */
export const STUDIO_LOCAL_GATEWAY_API_V1 = `${STUDIO_DEV_GATEWAY_ORIGIN_DEFAULT}/api/v1`;

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "[::1]"
  );
}

/**
 * Mirrors `next.config.ts` `env.NEXT_PUBLIC_API_URL` fallback so Edge and Node see the same effective value.
 */
export function getEffectiveNextPublicApiUrl(
  e: Record<string, string | undefined>,
): string {
  const raw = e[Env.NEXT_PUBLIC_API_URL]?.trim();
  if (raw) return raw;
  if (e.NODE_ENV === "production") return "";
  return STUDIO_DEV_GATEWAY_ORIGIN_DEFAULT;
}

/**
 * Normalize user-provided API URL to `origin[/api/v1]` form ending with `/api/v1`.
 */
export function normalizeToBackendApiV1(urlish: string): string {
  const trimmed = urlish.trim().replace(/\/$/, "");
  let origin = trimmed;
  try {
    const parsed = new URL(
      trimmed.startsWith("http") ? trimmed : `http://${trimmed}`,
    );
    origin = parsed.origin;
  } catch {
    const slash = trimmed.indexOf("/", trimmed.indexOf("//") + 2);
    origin = slash > 0 ? trimmed.slice(0, slash) : trimmed;
  }
  return origin.endsWith("/api/v1") ? origin : `${origin}/api/v1`;
}

let developmentNonLoopbackApiWarned = false;

/**
 * Reset warning dedupe (Vitest only).
 * @internal
 */
export function resetStudioPublicEnvDevWarningsForTests(): void {
  developmentNonLoopbackApiWarned = false;
}

/**
 * In `next dev`, a remote `NEXT_PUBLIC_API_URL` (from root `.env`) forces the browser to call prod;
 * use local gateway unless `NEXT_PUBLIC_ENV` is `staging` | `stage` (explicit remote API testing).
 */
export function applyDevelopmentLocalGatewayRule(
  e: Record<string, string | undefined>,
  resolvedApiV1: string,
): string {
  if (e.NODE_ENV !== "development") {
    return resolvedApiV1;
  }
  const channel = e[Env.NEXT_PUBLIC_ENV] ?? "";
  if (channel === "staging" || channel === "stage") {
    return resolvedApiV1;
  }
  try {
    const u = new URL(
      resolvedApiV1.startsWith("http")
        ? resolvedApiV1
        : `https://${resolvedApiV1}`,
    );
    if (isLoopbackHostname(u.hostname)) {
      return resolvedApiV1;
    }
  } catch {
    return resolvedApiV1;
  }
  if (!developmentNonLoopbackApiWarned) {
    developmentNonLoopbackApiWarned = true;
    console.warn(
      `[${Env.NEXT_PUBLIC_API_URL}] Development points at a non-loopback API; using ${STUDIO_LOCAL_GATEWAY_API_V1}. ` +
        `Set ${Env.NEXT_PUBLIC_ENV}=staging to keep the configured URL, or set ${Env.NEXT_PUBLIC_API_URL} to a loopback gateway.`,
    );
  }
  return STUDIO_LOCAL_GATEWAY_API_V1;
}

/**
 * Single resolution for Studio → gateway `.../api/v1` used by client and Edge CSP.
 */
export function resolveStudioBackendApiV1FromEnv(
  e: Record<string, string | undefined>,
): string {
  const effective = getEffectiveNextPublicApiUrl(e);
  if (!effective) {
    if (e.NODE_ENV === "production") {
      throw new Error(
        `${Env.NEXT_PUBLIC_API_URL} is required in production`,
      );
    }
    return STUDIO_LOCAL_GATEWAY_API_V1;
  }
  const normalized = normalizeToBackendApiV1(effective);
  return applyDevelopmentLocalGatewayRule(e, normalized);
}

const CONNECT_SRC_EXTRA = [
  "https://api.openai.com",
  "https://api.anthropic.com",
  "https://generativelanguage.googleapis.com",
  "https://api.together.xyz",
  "wss:",
  "https://*.thirdweb.com",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://base-sepolia-testnet.skalenodes.com",
  "https://skale-base.skalenodes.com",
  "https://sepolia.base.org",
  "https://*.bundler.thirdweb.com",
] as const;

/**
 * Content-Security-Policy `connect-src` value aligned with Studio middleware / bootstrap (gateway + LLM + wallets).
 */
export function buildStudioConnectSrcDirective(
  e: Record<string, string | undefined>,
): string {
  let resolved: string;
  try {
    resolved = resolveStudioBackendApiV1FromEnv(e);
  } catch {
    resolved = STUDIO_LOCAL_GATEWAY_API_V1;
  }
  let apiOrigin = "";
  try {
    const u = new URL(
      resolved.startsWith("http") ? resolved : `https://${resolved}`,
    );
    apiOrigin = u.origin;
  } catch {
    apiOrigin = "";
  }
  return ["'self'", apiOrigin, "http://localhost:4000", "http://127.0.0.1:4000", ...CONNECT_SRC_EXTRA]
    .filter(Boolean)
    .join(" ");
}

/**
 * Fail fast on invalid public URL when set (all environments).
 */
export function assertValidStudioPublicApiUrlIfPresent(
  e: Record<string, string | undefined>,
): void {
  const raw = e[Env.NEXT_PUBLIC_API_URL]?.trim();
  if (!raw) return;
  try {
    new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    throw new Error(
      `Invalid ${Env.NEXT_PUBLIC_API_URL}: "${raw}" (must be a valid URL)`,
    );
  }
}
