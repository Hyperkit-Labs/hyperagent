/**
 * API gateway rate limits via @upstash/ratelimit (HTTP REST). Security is mandatory in production.
 *
 * Production: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the Upstash console.
 * TCP redis:// / rediss:// (REDIS_URL) is for orchestrator/workers only, not this middleware.
 *
 * POST /api/v1/auth/bootstrap skips the Upstash tier when NODE_ENV !== "production".
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Response, NextFunction } from "express";
import { ApiPaths, GatewayLegacyMountPaths } from "@hyperagent/api-contracts";
import { getGatewayEnv } from "@hyperagent/config";
import { RequestWithId } from "./requestId.js";
import { RequestWithUser } from "./auth.js";
import { clientRemoteIp } from "./clientIp.js";
import { log } from "./logger.js";

function restUrl(): string {
  return getGatewayEnv().redisRest.restUrl;
}

function restToken(): string {
  return getGatewayEnv().redisRest.restToken;
}

function nodeEnv(): string {
  return getGatewayEnv().nodeEnv;
}

const LLM_KEYS_PATH = ApiPaths.workspacesCurrentLlmKeys;
const LLM_KEYS_PATH_LEGACY = "/workspaces/current/llm-keys";
const BOOTSTRAP_PATH = ApiPaths.authBootstrap;

const REST_BACKOFF_MS = 60_000;
let lastRestFailure = 0;

const UPSTASH_LIMIT_TIMEOUT_ERROR = "upstash_ratelimit_timeout";

/**
 * Upper bound for a single @upstash/ratelimit `limit()` HTTP round-trip.
 * Without this, a stalled Upstash connection can leave the client waiting until the browser or proxy gives up.
 */
function upstashLimitTimeoutMs(): number {
  const raw = (process.env.UPSTASH_RATELIMIT_TIMEOUT_MS || "").trim();
  const fallback = 8_000;
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(30_000, Math.max(1_000, n));
}

function limitWithDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(UPSTASH_LIMIT_TIMEOUT_ERROR));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type LimitOutcome =
  | { ok: true }
  | { ok: false; reason: "limit"; retryAfterSec: number }
  | { ok: false; reason: "redis_auth" }
  | { ok: false; reason: "redis_error" }
  | { ok: false; reason: "redis_unavailable" };

function isAuthError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  const lower = m.toLowerCase();
  return lower.includes("401") || lower.includes("unauthorized") || lower.includes("wrong token");
}

function rest503Message(reason: "redis_auth" | "redis_error" | "redis_unavailable"): string {
  if (reason === "redis_auth") {
    return "Rate limiting cannot authenticate to Upstash REST. Check UPSTASH_REDIS_REST_TOKEN and UPSTASH_REDIS_REST_URL.";
  }
  if (reason === "redis_unavailable") {
    return "Rate limiting unavailable. Upstash REST unreachable. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.";
  }
  return "Rate limiting unavailable due to an Upstash error. Check server logs and REST credentials.";
}

let redisClient: Redis | null = null;

function getRedisRest(): Redis | null {
  const url = restUrl();
  const token = restToken();
  if (!url || !token) return null;
  if (Date.now() - lastRestFailure < REST_BACKOFF_MS) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    lastRestFailure = Date.now();
    redisClient = null;
    const errMsg = err instanceof Error ? err.message : String(err);
    if (nodeEnv() === "development") {
      log.warn({ err: errMsg }, "Upstash REST client init failed, skipping rate limit");
    } else {
      log.error({ err: errMsg }, "Upstash REST client init failed");
    }
    return null;
  }
}

const limiterCache = new Map<string, Ratelimit>();

/** @upstash/ratelimit fixedWindow expects a Duration template (e.g. "60 s"), not a plain string. */
function durationSeconds(seconds: number): `${number} s` {
  return `${seconds} s` as `${number} s`;
}

function getLimiter(redis: Redis, max: number, windowSeconds: number, name: string): Ratelimit {
  const windowLabel = durationSeconds(windowSeconds);
  const key = `${name}:${max}:${windowLabel}`;
  let lim = limiterCache.get(key);
  if (!lim) {
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(max, windowLabel),
      prefix: `hyperagent:rl:${name}`,
      analytics: false,
    });
    limiterCache.set(key, lim);
  }
  return lim;
}

function resetRestClient(): void {
  lastRestFailure = Date.now();
  redisClient = null;
  limiterCache.clear();
}

async function checkLimit(
  limiter: Ratelimit,
  identifier: string,
  defaultRetrySec: number
): Promise<LimitOutcome> {
  try {
    const result = await limitWithDeadline(
      limiter.limit(identifier),
      upstashLimitTimeoutMs(),
    );
    if (result.success) return { ok: true };
    const retryAfterSec = Math.max(
      1,
      typeof result.reset === "number"
        ? Math.ceil((result.reset - Date.now()) / 1000) || defaultRetrySec
        : defaultRetrySec
    );
    return { ok: false, reason: "limit", retryAfterSec };
  } catch (err) {
    resetRestClient();
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg === UPSTASH_LIMIT_TIMEOUT_ERROR) {
      const ms = upstashLimitTimeoutMs();
      log.error({ timeoutMs: ms }, "Upstash limit() timed out");
      if (nodeEnv() !== "production") {
        log.warn("Upstash ratelimit timeout in dev; allowing request");
        return { ok: true };
      }
      return { ok: false, reason: "redis_unavailable" };
    }
    if (nodeEnv() !== "production") {
      log.warn({ err: errMsg }, "Upstash limit() failed, skipping rate limit");
      return { ok: true };
    }
    log.error({ err: errMsg }, "Upstash limit() failed");
    if (isAuthError(err)) return { ok: false, reason: "redis_auth" };
    return { ok: false, reason: "redis_error" };
  }
}

function sendLimitOrRedis(
  req: RateLimitRequest,
  res: Response,
  outcome: LimitOutcome,
  limit: { retryAfterSec: number; event: string; message: string }
): boolean {
  if (outcome.ok) return true;
  if (outcome.reason === "limit") {
    logSecurityEvent(limit.event, 429, req.path, req.requestId, req.userId);
    res.setHeader("Retry-After", String(outcome.retryAfterSec));
    res.status(429).json({
      error: "Too Many Requests",
      message: limit.message,
      requestId: req.requestId,
    });
    return false;
  }
  logSecurityEvent("rate_limit_redis", 503, req.path, req.requestId, req.userId);
  res.status(503).json({
    error: "Service Unavailable",
    message: rest503Message(outcome.reason),
    requestId: req.requestId,
  });
  return false;
}

export type RateLimitRequest = RequestWithId & RequestWithUser;

export function hasRestRateLimitEnv(): boolean {
  return Boolean(restUrl() && restToken());
}

export async function rateLimitMiddleware(
  req: RateLimitRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const path = req.path || "";
  if (path === "/health" || path === "/health/signin" || path === "/health/live") {
    next();
    return;
  }

  const rl = getGatewayEnv().rateLimits;

  if (!hasRestRateLimitEnv()) {
    if (nodeEnv() === "production") {
      logSecurityEvent("rate_limit_unavailable", 503, req.path, req.requestId, req.userId);
      res.status(503).json({
        error: "Service Unavailable",
        message:
          "Rate limiting required. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production.",
        requestId: req.requestId,
      });
      return;
    }
    next();
    return;
  }

  const redis = getRedisRest();
  if (!redis) {
    if (nodeEnv() === "production") {
      if (rl.bypassOnFail) {
        log.warn("Upstash unreachable. rl.bypassOnFail ignored in production (fail-closed)");
      }
      logSecurityEvent("rate_limit_unavailable", 503, req.path, req.requestId, req.userId);
      res.status(503).json({
        error: "Service Unavailable",
        message: rest503Message("redis_unavailable"),
        requestId: req.requestId,
      });
      return;
    }
    next();
    return;
  }

  const isBootstrap = req.method === "POST" && req.path === BOOTSTRAP_PATH;
  if (isBootstrap) {
    if (nodeEnv() !== "production") {
      next();
      return;
    }
    const ip = clientRemoteIp(req);
    const lim = getLimiter(redis, rl.bootstrapMaxIp, rl.bootstrapWindowSec, "bootstrap");
    const bootstrapOutcome = await checkLimit(lim, ip, rl.bootstrapWindowSec);
    if (
      !sendLimitOrRedis(req, res, bootstrapOutcome, {
        retryAfterSec: rl.bootstrapWindowSec,
        event: "rate_limit_bootstrap",
        message: "Too many sign-in attempts. Try again later.",
      })
    ) {
      return;
    }
    next();
    return;
  }

  const isLightweightRead =
    req.method === "GET" &&
    (req.path === ApiPaths.config ||
      req.path === ApiPaths.configIntegrationsDebug ||
      req.path === GatewayLegacyMountPaths.config ||
      req.path === GatewayLegacyMountPaths.integrationsDebugConfig ||
      req.path === GatewayLegacyMountPaths.platformTrackRecord ||
      req.path === ApiPaths.networks ||
      req.path === ApiPaths.tokensStablecoins ||
      req.path === GatewayLegacyMountPaths.networks ||
      req.path.startsWith(`${GatewayLegacyMountPaths.networks}/`) ||
      req.path === "/tokens/stablecoins" ||
      req.path === "/presets" ||
      req.path === "/blueprints" ||
      req.path === "/templates" ||
      req.path.startsWith("/templates/"));
  if (isLightweightRead) {
    const ip = clientRemoteIp(req);
    const userId = req.userId || "";

    if (userId) {
      const lim = getLimiter(redis, rl.lightMaxUser, rl.windowSec, "light-user");
      const userOutcome = await checkLimit(lim, userId, rl.windowSec);
      if (
        !sendLimitOrRedis(req, res, userOutcome, {
          retryAfterSec: rl.windowSec,
          event: "rate_limit_light",
          message: "Config/networks rate limit exceeded. Try again later.",
        })
      ) {
        return;
      }
    } else {
      const lim = getLimiter(redis, rl.lightMaxIp, rl.windowSec, "light-ip");
      const lightOutcome = await checkLimit(lim, ip, rl.windowSec);
      if (
        !sendLimitOrRedis(req, res, lightOutcome, {
          retryAfterSec: rl.windowSec,
          event: "rate_limit_light",
          message: "Config/networks rate limit exceeded. Try again later.",
        })
      ) {
        return;
      }
    }
    next();
    return;
  }

  const ip = clientRemoteIp(req);
  const userId = req.userId || "";

  const isByokRoute = req.path.startsWith(ApiPaths.byokPrefix);
  if (isByokRoute) {
    const limIp = getLimiter(redis, rl.byokMaxIp, rl.windowSec, "byok-ip");
    const byokIp = await checkLimit(limIp, ip, rl.windowSec);
    if (
      !sendLimitOrRedis(req, res, byokIp, {
        retryAfterSec: rl.windowSec,
        event: "rate_limit_byok",
        message: "BYOK key management rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
    if (userId) {
      const limU = getLimiter(redis, rl.byokMaxUser, rl.windowSec, "byok-user");
      const byokUser = await checkLimit(limU, userId, rl.windowSec);
      if (
        !sendLimitOrRedis(req, res, byokUser, {
          retryAfterSec: rl.windowSec,
          event: "rate_limit_byok",
          message: "BYOK key management rate limit exceeded.",
        })
      ) {
        return;
      }
    }
    next();
    return;
  }

  const isLlmKeysPost =
    req.method === "POST" &&
    (req.path === LLM_KEYS_PATH || req.path === LLM_KEYS_PATH_LEGACY);
  const isWorkflowGenerate =
    req.method === "POST" &&
    (req.path === ApiPaths.workflowsGenerate ||
      req.path === "/workflows/generate");
  const isDeployPrepare =
    req.method === "POST" &&
    (/^\/api\/v1\/workflows\/[^/]+\/deploy\/prepare$/.test(req.path) ||
      /^\/workflows\/[^/]+\/deploy\/prepare$/.test(req.path));

  if (isWorkflowGenerate) {
    const limIp = getLimiter(redis, rl.workflowGenerateMaxIp, rl.windowSec, "wf-ip");
    const wfIp = await checkLimit(limIp, ip, rl.windowSec);
    if (
      !sendLimitOrRedis(req, res, wfIp, {
        retryAfterSec: rl.windowSec,
        event: "rate_limit_workflow_generate",
        message: "Workflow start rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
    if (userId) {
      const limU = getLimiter(redis, rl.workflowGenerateMaxUser, rl.windowSec, "wf-user");
      const wfUser = await checkLimit(limU, userId, rl.windowSec);
      if (
        !sendLimitOrRedis(req, res, wfUser, {
          retryAfterSec: rl.windowSec,
          event: "rate_limit_workflow_generate",
          message: "Workflow start rate limit exceeded.",
        })
      ) {
        return;
      }
    }
  }

  if (isDeployPrepare) {
    const limIp = getLimiter(redis, rl.deployPrepareMaxIp, rl.windowSec, "deploy-ip");
    const dpIp = await checkLimit(limIp, ip, rl.windowSec);
    if (
      !sendLimitOrRedis(req, res, dpIp, {
        retryAfterSec: rl.windowSec,
        event: "rate_limit_deploy_prepare",
        message: "Deploy prepare rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
    if (userId) {
      const limU = getLimiter(redis, rl.deployPrepareMaxUser, rl.windowSec, "deploy-user");
      const dpUser = await checkLimit(limU, userId, rl.windowSec);
      if (
        !sendLimitOrRedis(req, res, dpUser, {
          retryAfterSec: rl.windowSec,
          event: "rate_limit_deploy_prepare",
          message: "Deploy prepare rate limit exceeded.",
        })
      ) {
        return;
      }
    }
  }

  const limIpMain = getLimiter(redis, rl.maxIp, rl.windowSec, "ip");
  const ipOutcome = await checkLimit(limIpMain, ip, rl.windowSec);
  if (
    !sendLimitOrRedis(req, res, ipOutcome, {
      retryAfterSec: rl.windowSec,
      event: "rate_limit",
      message: "Rate limit exceeded. Try again later.",
    })
  ) {
    return;
  }

  if (isLlmKeysPost) {
    const limLlmIp = getLimiter(redis, rl.llmKeysMaxIp, rl.windowSec, "llm-ip");
    const llmIp = await checkLimit(limLlmIp, ip, rl.windowSec);
    if (
      !sendLimitOrRedis(req, res, llmIp, {
        retryAfterSec: rl.windowSec,
        event: "rate_limit_llm_keys",
        message: "LLM keys endpoint rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
  }

  if (userId) {
    const userMax = isLlmKeysPost ? rl.llmKeysMaxUser : rl.maxUser;
    const name = isLlmKeysPost ? "llm-user" : "user";
    const limUser = getLimiter(redis, userMax, rl.windowSec, name);
    const userOutcome = await checkLimit(limUser, userId, rl.windowSec);
    if (
      !sendLimitOrRedis(req, res, userOutcome, {
        retryAfterSec: rl.windowSec,
        event: "rate_limit",
        message: "User rate limit exceeded.",
      })
    ) {
      return;
    }
  }

  next();
}

function logSecurityEvent(
  event: string,
  status: number,
  path: string,
  requestId?: string,
  userId?: string
): void {
  const payload: Record<string, unknown> = { event, status, path };
  if (requestId) payload.requestId = requestId;
  if (userId) payload.userId = userId;
  log.warn(payload, "security event");
}
