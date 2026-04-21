import { Env } from "./keys.js";
import {
  parseEnvBool,
  parseEnvFloat,
  parseEnvNonNegativeInt,
  parseOptionalEnvBool,
} from "./parse.js";

export interface GatewayRedisRest {
  readonly restUrl: string;
  readonly restToken: string;
}

export interface GatewayRateLimits {
  readonly windowSec: number;
  readonly multiplier: number;
  readonly bypassOnFail: boolean;
  readonly maxIp: number;
  readonly maxUser: number;
  readonly llmKeysMaxIp: number;
  readonly llmKeysMaxUser: number;
  readonly workflowGenerateMaxIp: number;
  readonly workflowGenerateMaxUser: number;
  readonly deployPrepareMaxIp: number;
  readonly deployPrepareMaxUser: number;
  readonly bootstrapMaxIp: number;
  readonly bootstrapWindowSec: number;
  readonly lightMaxIp: number;
  readonly lightMaxUser: number;
  readonly byokMaxIp: number;
  readonly byokMaxUser: number;
}

export interface GatewayEnv {
  readonly nodeEnv: string;
  readonly isProduction: boolean;
  readonly port: number;
  readonly orchestratorUrl: string;
  readonly proxyTimeoutMs: number;
  readonly corsOrigins: string[];
  readonly auth: {
    readonly jwtSecret: string | undefined;
    readonly requireAuth: boolean;
  };
  readonly supabase: {
    readonly url: string | undefined;
    readonly serviceKey: string | undefined;
  };
  readonly bootstrap: {
    readonly thirdwebSecretKey: string | undefined;
    readonly jwtExpiresInSec: number;
    readonly freemiumInitialCredits: number;
    readonly enableDebugLog: boolean;
  };
  readonly redisRest: GatewayRedisRest;
  readonly rateLimits: GatewayRateLimits;
  readonly identityHmacSecret: string;
  readonly metering: {
    readonly enforced: boolean;
    readonly minBalance: number;
  };
  readonly billing: {
    readonly x402EnabledForHints: boolean;
    readonly merchantWallet: string;
    readonly defaultTopupBaseUnits: string;
  };
  readonly sentry: {
    readonly dsn: string | undefined;
    readonly environment: string | undefined;
    readonly tracesSampleRate: number;
  };
  readonly otel: {
    readonly enabled: boolean;
    readonly otlpEndpoint: string;
    readonly tracesEndpoint: string;
    readonly metricsEndpoint: string;
    readonly serviceName: string;
  };
  readonly platform: {
    readonly auditsCompleted: string | undefined;
    readonly vulnerabilitiesFound: string | undefined;
    readonly securityResearchers: string | undefined;
    readonly contractsDeployed: string | undefined;
  };
  readonly waitlist: {
    readonly url: string | undefined;
    readonly serviceKey: string | undefined;
    readonly allowlistEnforced: boolean;
  };
}

function trimEnv(e: NodeJS.ProcessEnv, key: string): string {
  return (e[key] || "").trim();
}

function parseCorsOrigins(e: NodeJS.ProcessEnv, isProduction: boolean): string[] {
  const configured = trimEnv(e, Env.CORS_ORIGINS) || trimEnv(e, Env.CORS_ORIGIN);
  const raw =
    configured || (isProduction ? "" : "http://localhost:3000");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveMeteringEnforced(
  value: string | undefined,
  isProduction: boolean,
): boolean {
  return parseOptionalEnvBool(value) ?? isProduction;
}

/** When unset: on in production, off in non-production. Set `X402_ENABLED=0` to disable in prod. */
function resolveX402Enabled(e: NodeJS.ProcessEnv, isProduction: boolean): boolean {
  const parsed = parseOptionalEnvBool(e[Env.X402_ENABLED]);
  if (parsed !== undefined) {
    return parsed;
  }
  return isProduction;
}

function resolveRequireAuth(
  value: string | undefined,
  isProduction: boolean,
): boolean {
  // Preserve the existing dev-only escape hatch: only the literal "false" disables auth.
  return isProduction || value !== "false";
}

function buildRateLimits(e: NodeJS.ProcessEnv): GatewayRateLimits {
  const windowSec = parseEnvNonNegativeInt(e[Env.RATE_LIMIT_WINDOW_SEC], 60);
  const multiplier = Math.max(0.1, parseEnvFloat(e[Env.RATE_LIMIT_MULTIPLIER], 1));
  const m = (n: number) => Math.round(n * multiplier);
  const bootstrapFromSiweIp = parseEnvNonNegativeInt(e[Env.RATE_LIMIT_BOOTSTRAP_MAX_IP], 0);
  const bootstrapIp =
    bootstrapFromSiweIp ||
    parseEnvNonNegativeInt(e[Env.RATE_LIMIT_SIWE_MAX_IP], 5);
  const bootstrapWindow =
    parseEnvNonNegativeInt(e[Env.RATE_LIMIT_SIWE_WINDOW_SEC], 0) ||
    parseEnvNonNegativeInt(e[Env.RATE_LIMIT_BOOTSTRAP_WINDOW_SEC], 60);

  return {
    windowSec,
    multiplier,
    bypassOnFail: parseEnvBool(e[Env.RATE_LIMIT_BYPASS_ON_FAIL], false),
    maxIp: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_MAX_IP], 300)),
    maxUser: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_MAX_USER], 500)),
    llmKeysMaxIp: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_LLM_KEYS_MAX_IP], 10)),
    llmKeysMaxUser: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_LLM_KEYS_MAX_USER], 5)),
    workflowGenerateMaxIp: m(
      parseEnvNonNegativeInt(e[Env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP], 20),
    ),
    workflowGenerateMaxUser: m(
      parseEnvNonNegativeInt(e[Env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER], 30),
    ),
    deployPrepareMaxIp: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_DEPLOY_PREPARE_MAX_IP], 30)),
    deployPrepareMaxUser: m(
      parseEnvNonNegativeInt(e[Env.RATE_LIMIT_DEPLOY_PREPARE_MAX_USER], 50),
    ),
    bootstrapMaxIp: m(bootstrapIp),
    bootstrapWindowSec: bootstrapWindow,
    lightMaxIp: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_LIGHT_MAX_IP], 100)),
    lightMaxUser: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_LIGHT_MAX_USER], 500)),
    byokMaxIp: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_BYOK_MAX_IP], 15)),
    byokMaxUser: m(parseEnvNonNegativeInt(e[Env.RATE_LIMIT_BYOK_MAX_USER], 10)),
  };
}

/**
 * Pure builder: tests pass a custom env object; runtime uses process.env.
 */
export function buildGatewayEnv(e: NodeJS.ProcessEnv): GatewayEnv {
  const nodeEnv = e[Env.NODE_ENV] || "development";
  const isProduction = nodeEnv === "production";
  const meteringEnforced = resolveMeteringEnforced(
    e[Env.METERING_ENFORCED],
    isProduction,
  );
  const x402EnabledForHints = resolveX402Enabled(e, isProduction);
  const requireAuth = resolveRequireAuth(e[Env.REQUIRE_AUTH], isProduction);

  return {
    nodeEnv,
    isProduction,
    port: parseEnvNonNegativeInt(e[Env.PORT], 4000),
    orchestratorUrl: trimEnv(e, Env.ORCHESTRATOR_URL) || "http://localhost:8000",
    // Default must exceed Studio bootstrap/BYOK client timeouts (45s / 35s in apps/studio/lib/api/core.ts)
    // so the gateway does not reset the upstream socket while the browser is still waiting.
    proxyTimeoutMs: parseEnvNonNegativeInt(e[Env.PROXY_TIMEOUT_MS], 120_000),
    corsOrigins: parseCorsOrigins(e, isProduction),
    auth: {
      jwtSecret: trimEnv(e, Env.AUTH_JWT_SECRET) || undefined,
      requireAuth,
    },
    supabase: {
      url: trimEnv(e, Env.SUPABASE_URL) || undefined,
      serviceKey: trimEnv(e, Env.SUPABASE_SERVICE_KEY) || undefined,
    },
    bootstrap: {
      thirdwebSecretKey: trimEnv(e, Env.THIRDWEB_SECRET_KEY) || undefined,
      jwtExpiresInSec: parseEnvNonNegativeInt(e[Env.AUTH_JWT_EXPIRES_IN], 86_400),
      freemiumInitialCredits: parseEnvFloat(e[Env.FREEMIUM_INITIAL_CREDITS], 100),
      enableDebugLog:
        nodeEnv !== "production" && parseEnvBool(e[Env.ENABLE_BOOTSTRAP_DEBUG_LOG], false),
    },
    redisRest: {
      restUrl: trimEnv(e, Env.UPSTASH_REDIS_REST_URL),
      restToken: trimEnv(e, Env.UPSTASH_REDIS_REST_TOKEN),
    },
    rateLimits: buildRateLimits(e),
    identityHmacSecret: trimEnv(e, Env.IDENTITY_HMAC_SECRET),
    metering: {
      enforced: meteringEnforced,
      minBalance: parseEnvFloat(e[Env.METERING_MIN_BALANCE], 0),
    },
    billing: {
      x402EnabledForHints,
      merchantWallet: trimEnv(e, Env.MERCHANT_WALLET_ADDRESS),
      defaultTopupBaseUnits:
        trimEnv(e, Env.X402_DEFAULT_TOPUP_BASE_UNITS) || "1000000",
    },
    sentry: {
      dsn: trimEnv(e, Env.SENTRY_DSN) || undefined,
      environment: trimEnv(e, Env.SENTRY_ENVIRONMENT) || undefined,
      tracesSampleRate: parseEnvFloat(e[Env.SENTRY_TRACES_SAMPLE_RATE], 0.1),
    },
    otel: {
      enabled: parseEnvBool(e[Env.OPENTELEMETRY_ENABLED], false),
      otlpEndpoint: trimEnv(e, Env.OTEL_EXPORTER_OTLP_ENDPOINT) || "http://127.0.0.1:4318",
      tracesEndpoint: trimEnv(e, Env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT),
      metricsEndpoint: trimEnv(e, Env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT),
      serviceName: trimEnv(e, Env.OTEL_SERVICE_NAME) || "api-gateway",
    },
    platform: {
      auditsCompleted: e[Env.PLATFORM_AUDITS_COMPLETED],
      vulnerabilitiesFound: e[Env.PLATFORM_VULNERABILITIES_FOUND],
      securityResearchers: e[Env.PLATFORM_SECURITY_RESEARCHERS],
      contractsDeployed: e[Env.PLATFORM_CONTRACTS_DEPLOYED],
    },
    waitlist: {
      url: trimEnv(e, Env.WAITLIST_SUPABASE_URL) || undefined,
      serviceKey: trimEnv(e, Env.WAITLIST_SUPABASE_SERVICE_KEY) || undefined,
      allowlistEnforced: parseEnvBool(e[Env.BETA_ALLOWLIST_ENFORCED], false),
    },
  };
}

let _gatewayCache: GatewayEnv | null = null;

export function getGatewayEnv(): GatewayEnv {
  if (!_gatewayCache) {
    _gatewayCache = Object.freeze(buildGatewayEnv(process.env));
  }
  return _gatewayCache;
}

export function resetGatewayEnvForTests(): void {
  _gatewayCache = null;
}
