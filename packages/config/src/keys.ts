/**
 * Canonical env var names (single owner per concern). Import these instead of string literals.
 *
 * - `Env.Config` — non-sensitive; safe in ConfigMaps (still protect from public leaks).
 * - `Env.Secrets` — credentials and key material; Kubernetes Secret / External Secrets only.
 * - `EnvFlat` — merged string map (use in `Object.values` / validators).
 * - `Env` — `EnvFlat` plus nested `Config` and `Secrets` (backward compatible: `Env.PORT`).
 *
 * Gateway user JWT: `AUTH_JWT_SECRET`. Agent session JWT: `JWT_SECRET_KEY` (orchestrator ↔ agent-runtime only).
 */

export const EnvConfig = {
  NODE_ENV: "NODE_ENV",
  PORT: "PORT",
  ORCHESTRATOR_URL: "ORCHESTRATOR_URL",
  PROXY_TIMEOUT_MS: "PROXY_TIMEOUT_MS",
  CORS_ORIGINS: "CORS_ORIGINS",
  CORS_ORIGIN: "CORS_ORIGIN",
  REQUIRE_AUTH: "REQUIRE_AUTH",
  SUPABASE_URL: "SUPABASE_URL",
  AUTH_JWT_EXPIRES_IN: "AUTH_JWT_EXPIRES_IN",
  FREEMIUM_INITIAL_CREDITS: "FREEMIUM_INITIAL_CREDITS",
  ENABLE_BOOTSTRAP_DEBUG_LOG: "ENABLE_BOOTSTRAP_DEBUG_LOG",
  UPSTASH_REDIS_REST_URL: "UPSTASH_REDIS_REST_URL",
  RATE_LIMIT_BYPASS_ON_FAIL: "RATE_LIMIT_BYPASS_ON_FAIL",
  RATE_LIMIT_WINDOW_SEC: "RATE_LIMIT_WINDOW_SEC",
  RATE_LIMIT_MULTIPLIER: "RATE_LIMIT_MULTIPLIER",
  RATE_LIMIT_MAX_IP: "RATE_LIMIT_MAX_IP",
  RATE_LIMIT_MAX_USER: "RATE_LIMIT_MAX_USER",
  RATE_LIMIT_LLM_KEYS_MAX_IP: "RATE_LIMIT_LLM_KEYS_MAX_IP",
  RATE_LIMIT_LLM_KEYS_MAX_USER: "RATE_LIMIT_LLM_KEYS_MAX_USER",
  RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP: "RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP",
  RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER: "RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER",
  RATE_LIMIT_DEPLOY_PREPARE_MAX_IP: "RATE_LIMIT_DEPLOY_PREPARE_MAX_IP",
  RATE_LIMIT_DEPLOY_PREPARE_MAX_USER: "RATE_LIMIT_DEPLOY_PREPARE_MAX_USER",
  RATE_LIMIT_BOOTSTRAP_MAX_IP: "RATE_LIMIT_BOOTSTRAP_MAX_IP",
  RATE_LIMIT_BOOTSTRAP_WINDOW_SEC: "RATE_LIMIT_BOOTSTRAP_WINDOW_SEC",
  RATE_LIMIT_SIWE_MAX_IP: "RATE_LIMIT_SIWE_MAX_IP",
  RATE_LIMIT_SIWE_WINDOW_SEC: "RATE_LIMIT_SIWE_WINDOW_SEC",
  RATE_LIMIT_LIGHT_MAX_IP: "RATE_LIMIT_LIGHT_MAX_IP",
  RATE_LIMIT_LIGHT_MAX_USER: "RATE_LIMIT_LIGHT_MAX_USER",
  RATE_LIMIT_BYOK_MAX_IP: "RATE_LIMIT_BYOK_MAX_IP",
  RATE_LIMIT_BYOK_MAX_USER: "RATE_LIMIT_BYOK_MAX_USER",
  METERING_ENFORCED: "METERING_ENFORCED",
  METERING_MIN_BALANCE: "METERING_MIN_BALANCE",
  /** Unset: on when `NODE_ENV=production`, off otherwise; set `0`/`false` to disable in prod. */
  X402_ENABLED: "X402_ENABLED",
  X402_MANDATORY_V01: "X402_MANDATORY_V01",
  X402_ENFORCE_INTERNAL: "X402_ENFORCE_INTERNAL",
  MERCHANT_WALLET_ADDRESS: "MERCHANT_WALLET_ADDRESS",
  /** USDC base units (e.g. 1000000 = 1 USDC) for x402 insufficient-credit hints. */
  X402_DEFAULT_TOPUP_BASE_UNITS: "X402_DEFAULT_TOPUP_BASE_UNITS",
  SENTRY_ENVIRONMENT: "SENTRY_ENVIRONMENT",
  SENTRY_TRACES_SAMPLE_RATE: "SENTRY_TRACES_SAMPLE_RATE",
  OPENTELEMETRY_ENABLED: "OPENTELEMETRY_ENABLED",
  OTEL_EXPORTER_OTLP_ENDPOINT: "OTEL_EXPORTER_OTLP_ENDPOINT",
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
  OTEL_SERVICE_NAME: "OTEL_SERVICE_NAME",
  PLATFORM_AUDITS_COMPLETED: "PLATFORM_AUDITS_COMPLETED",
  PLATFORM_VULNERABILITIES_FOUND: "PLATFORM_VULNERABILITIES_FOUND",
  PLATFORM_SECURITY_RESEARCHERS: "PLATFORM_SECURITY_RESEARCHERS",
  PLATFORM_CONTRACTS_DEPLOYED: "PLATFORM_CONTRACTS_DEPLOYED",
  /** When true, Studio enables ERC-8004 mirror sync (requires working POST /erc8004/sync). Default off until indexer ships. */
  NEXT_PUBLIC_ERC8004_SYNC_ENABLED: "NEXT_PUBLIC_ERC8004_SYNC_ENABLED",
  /** Public Studio ↔ gateway URL; single meaning across Edge proxy and browser bundle. */
  NEXT_PUBLIC_API_URL: "NEXT_PUBLIC_API_URL",
  /** Deployment channel (development | staging | production | …); used with NEXT_PUBLIC_API_URL for dev/staging semantics. */
  NEXT_PUBLIC_ENV: "NEXT_PUBLIC_ENV",
  /** Separate Supabase project for waitlist / beta (waitlist_entries). */
  WAITLIST_SUPABASE_URL: "WAITLIST_SUPABASE_URL",
  /**
   * When true, POST /auth/bootstrap requires a matching waitlist_entries row:
   * status=confirmed, email_confirmed=true, same wallet_address (case-insensitive).
   */
  BETA_ALLOWLIST_ENFORCED: "BETA_ALLOWLIST_ENFORCED",
} as const;

export const EnvSecrets = {
  AUTH_JWT_SECRET: "AUTH_JWT_SECRET",
  SUPABASE_SERVICE_KEY: "SUPABASE_SERVICE_KEY",
  THIRDWEB_SECRET_KEY: "THIRDWEB_SECRET_KEY",
  /** Orchestrator → agent-runtime: signs short-lived agent session JWT. Not `AUTH_JWT_SECRET`. */
  JWT_SECRET_KEY: "JWT_SECRET_KEY",
  /** Service-to-service bearer (storage, deploy, simulation, orchestrator callers). */
  INTERNAL_SERVICE_TOKEN: "INTERNAL_SERVICE_TOKEN",
  /** Fernet / BYOK at-rest encryption when KMS is not used. */
  LLM_KEY_ENCRYPTION_KEY: "LLM_KEY_ENCRYPTION_KEY",
  /** AWS KMS key ARN for BYOK envelope encryption (preferred in production). */
  LLM_KEY_KMS_KEY_ARN: "LLM_KEY_KMS_KEY_ARN",
  /** AES-256-GCM key material for payload inside agent session JWT (orchestrator + agent-runtime). */
  AGENT_SESSION_PAYLOAD_KEY: "AGENT_SESSION_PAYLOAD_KEY",
  UPSTASH_REDIS_REST_TOKEN: "UPSTASH_REDIS_REST_TOKEN",
  IDENTITY_HMAC_SECRET: "IDENTITY_HMAC_SECRET",
  SENTRY_DSN: "SENTRY_DSN",
  /** Service role for waitlist Supabase (server-side only; not HyperAgent main DB). */
  WAITLIST_SUPABASE_SERVICE_KEY: "WAITLIST_SUPABASE_SERVICE_KEY",
} as const;

export const EnvFlat = {
  ...EnvConfig,
  ...EnvSecrets,
} as const;

/** Flat keys plus grouped views for ConfigMaps vs Secrets. */
export const Env = Object.freeze({
  ...EnvFlat,
  Config: EnvConfig,
  Secrets: EnvSecrets,
});

export type EnvFlatKey = (typeof EnvFlat)[keyof typeof EnvFlat];
