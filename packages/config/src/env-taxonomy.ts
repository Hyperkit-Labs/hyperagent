/**
 * Config vs secrets taxonomy for operators and validators.
 * Values are the same strings as `Env`; use for documentation, CI gates, and runbooks—not for replacing `Env` in code.
 */

import { Env } from "./keys.js";

/** Browser-exposed via Next.js bundle; must not hold privileged secrets. */
export const publicBrowserEnvKeys = [
  Env.NEXT_PUBLIC_API_URL,
  Env.NEXT_PUBLIC_ENV,
] as const;

/** Gateway process: non-sensitive tuning with dev-friendly defaults in `buildGatewayEnv`. */
export const gatewayNonSecretConfigKeys = [
  Env.NODE_ENV,
  Env.PORT,
  Env.ORCHESTRATOR_URL,
  Env.PROXY_TIMEOUT_MS,
  Env.CORS_ORIGINS,
  Env.CORS_ORIGIN,
  Env.REQUIRE_AUTH,
  Env.SUPABASE_URL,
  Env.UPSTASH_REDIS_REST_URL,
  Env.AUTH_JWT_EXPIRES_IN,
  Env.FREEMIUM_INITIAL_CREDITS,
  Env.METERING_ENFORCED,
  Env.METERING_MIN_BALANCE,
  Env.X402_ENABLED,
  Env.X402_MANDATORY_V01,
  Env.X402_ENFORCE_INTERNAL,
  Env.MERCHANT_WALLET_ADDRESS,
  Env.X402_DEFAULT_TOPUP_BASE_UNITS,
  Env.WAITLIST_SUPABASE_URL,
  Env.BETA_ALLOWLIST_ENFORCED,
] as const;

/** Gateway and related: must not appear in logs or client bundles. */
export const gatewaySensitiveSecretKeys = [
  Env.AUTH_JWT_SECRET,
  Env.SUPABASE_SERVICE_KEY,
  Env.THIRDWEB_SECRET_KEY,
  Env.UPSTASH_REDIS_REST_TOKEN,
  Env.IDENTITY_HMAC_SECRET,
] as const;

/** Platform-wide shared secrets (multiple services). */
export const crossServiceSecretKeys = [
  Env.INTERNAL_SERVICE_TOKEN,
  Env.LLM_KEY_ENCRYPTION_KEY,
  Env.LLM_KEY_KMS_KEY_ARN,
  Env.JWT_SECRET_KEY,
  Env.AGENT_SESSION_PAYLOAD_KEY,
  Env.WAITLIST_SUPABASE_SERVICE_KEY,
] as const;

/** Union of all secret-class keys tracked in taxonomy (for checklists). */
export const allTaxonomySecretKeys: readonly string[] = Array.from(
  new Set<string>([
    ...gatewaySensitiveSecretKeys,
    ...crossServiceSecretKeys,
  ]),
);
