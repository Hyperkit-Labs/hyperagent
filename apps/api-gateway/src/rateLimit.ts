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
import { RequestWithId } from "./requestId.js";
import { RequestWithUser } from "./auth.js";

function restUrl(): string {
  return (process.env.UPSTASH_REDIS_REST_URL || "").trim();
}

function restToken(): string {
  return (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
}

function nodeEnv(): string {
  return process.env.NODE_ENV || "development";
}
/** When true, allow requests through when Upstash is unreachable (skip rate limit). Dev/staging only. */
const RATE_LIMIT_BYPASS_ON_FAIL = process.env.RATE_LIMIT_BYPASS_ON_FAIL === "true";
const RATE_LIMIT_WINDOW_SEC = Number(process.env.RATE_LIMIT_WINDOW_SEC) || 60;
/** Multiplier applied to all rate limits. Use 2 to double limits, 0.5 to halve. Default 1. */
const RATE_LIMIT_MULTIPLIER = Math.max(0.1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);

const RATE_LIMIT_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_MAX_IP) || 300) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_MAX_USER) || 500) * RATE_LIMIT_MULTIPLIER);

const LLM_KEYS_PATH = "/api/v1/workspaces/current/llm-keys";
const RATE_LIMIT_LLM_KEYS_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_IP) || 10) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_LLM_KEYS_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_USER) || 5) * RATE_LIMIT_MULTIPLIER);

const RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP) || 20) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER) || 30) * RATE_LIMIT_MULTIPLIER);

const RATE_LIMIT_DEPLOY_PREPARE_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_DEPLOY_PREPARE_MAX_IP) || 30) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_DEPLOY_PREPARE_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_DEPLOY_PREPARE_MAX_USER) || 50) * RATE_LIMIT_MULTIPLIER);

const BOOTSTRAP_PATH = "/api/v1/auth/bootstrap";
const RATE_LIMIT_BOOTSTRAP_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_BOOTSTRAP_MAX_IP) || Number(process.env.RATE_LIMIT_SIWE_MAX_IP) || 5) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_BOOTSTRAP_WINDOW_SEC = Number(process.env.RATE_LIMIT_SIWE_WINDOW_SEC) || Number(process.env.RATE_LIMIT_BOOTSTRAP_WINDOW_SEC) || 60;

const RATE_LIMIT_LIGHT_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_LIGHT_MAX_IP) || 100) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_LIGHT_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_LIGHT_MAX_USER) || 500) * RATE_LIMIT_MULTIPLIER);

const REST_BACKOFF_MS = 60_000;
let lastRestFailure = 0;

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
    if (nodeEnv() === "development") {
      console.warn("[rate-limit] Upstash REST client init failed, skipping rate limit:", err instanceof Error ? err.message : err);
    } else {
      console.error("[rate-limit] Upstash REST client init failed:", err instanceof Error ? err.message : err);
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
    const result = await limiter.limit(identifier);
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
    if (nodeEnv() !== "production") {
      console.warn("[rate-limit] Upstash limit() failed, skipping rate limit:", err instanceof Error ? err.message : err);
      return { ok: true };
    }
    console.error("[rate-limit] Upstash limit() failed:", err instanceof Error ? err.message : err);
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
  if (path === "/health" || path === "/health/live") {
    next();
    return;
  }

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
      if (RATE_LIMIT_BYPASS_ON_FAIL) {
        console.warn("[rate-limit] Upstash unreachable. RATE_LIMIT_BYPASS_ON_FAIL ignored in production (fail-closed).");
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
    const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const lim = getLimiter(redis, RATE_LIMIT_BOOTSTRAP_MAX_IP, RATE_LIMIT_BOOTSTRAP_WINDOW_SEC, "bootstrap");
    const bootstrapOutcome = await checkLimit(lim, ip, RATE_LIMIT_BOOTSTRAP_WINDOW_SEC);
    if (
      !sendLimitOrRedis(req, res, bootstrapOutcome, {
        retryAfterSec: RATE_LIMIT_BOOTSTRAP_WINDOW_SEC,
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
    (req.path === "/api/v1/config" ||
      req.path === "/api/v1/config/integrations-debug" ||
      req.path === "/api/v1/networks" ||
      req.path === "/api/v1/tokens/stablecoins");
  if (isLightweightRead) {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const userId = req.userId || "";

    if (userId) {
      const lim = getLimiter(redis, RATE_LIMIT_LIGHT_MAX_USER, RATE_LIMIT_WINDOW_SEC, "light-user");
      const userOutcome = await checkLimit(lim, userId, RATE_LIMIT_WINDOW_SEC);
      if (
        !sendLimitOrRedis(req, res, userOutcome, {
          retryAfterSec: RATE_LIMIT_WINDOW_SEC,
          event: "rate_limit_light",
          message: "Config/networks rate limit exceeded. Try again later.",
        })
      ) {
        return;
      }
    } else {
      const lim = getLimiter(redis, RATE_LIMIT_LIGHT_MAX_IP, RATE_LIMIT_WINDOW_SEC, "light-ip");
      const lightOutcome = await checkLimit(lim, ip, RATE_LIMIT_WINDOW_SEC);
      if (
        !sendLimitOrRedis(req, res, lightOutcome, {
          retryAfterSec: RATE_LIMIT_WINDOW_SEC,
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

  const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const userId = req.userId || "";
  const isLlmKeysPost = req.method === "POST" && req.path === LLM_KEYS_PATH;
  const isWorkflowGenerate = req.method === "POST" && req.path === "/api/v1/workflows/generate";
  const isDeployPrepare = req.method === "POST" && /^\/api\/v1\/workflows\/[^/]+\/deploy\/prepare$/.test(req.path);

  if (isWorkflowGenerate) {
    const limIp = getLimiter(redis, RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP, RATE_LIMIT_WINDOW_SEC, "wf-ip");
    const wfIp = await checkLimit(limIp, ip, RATE_LIMIT_WINDOW_SEC);
    if (
      !sendLimitOrRedis(req, res, wfIp, {
        retryAfterSec: RATE_LIMIT_WINDOW_SEC,
        event: "rate_limit_workflow_generate",
        message: "Workflow start rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
    if (userId) {
      const limU = getLimiter(redis, RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER, RATE_LIMIT_WINDOW_SEC, "wf-user");
      const wfUser = await checkLimit(limU, userId, RATE_LIMIT_WINDOW_SEC);
      if (
        !sendLimitOrRedis(req, res, wfUser, {
          retryAfterSec: RATE_LIMIT_WINDOW_SEC,
          event: "rate_limit_workflow_generate",
          message: "Workflow start rate limit exceeded.",
        })
      ) {
        return;
      }
    }
  }

  if (isDeployPrepare) {
    const limIp = getLimiter(redis, RATE_LIMIT_DEPLOY_PREPARE_MAX_IP, RATE_LIMIT_WINDOW_SEC, "deploy-ip");
    const dpIp = await checkLimit(limIp, ip, RATE_LIMIT_WINDOW_SEC);
    if (
      !sendLimitOrRedis(req, res, dpIp, {
        retryAfterSec: RATE_LIMIT_WINDOW_SEC,
        event: "rate_limit_deploy_prepare",
        message: "Deploy prepare rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
    if (userId) {
      const limU = getLimiter(redis, RATE_LIMIT_DEPLOY_PREPARE_MAX_USER, RATE_LIMIT_WINDOW_SEC, "deploy-user");
      const dpUser = await checkLimit(limU, userId, RATE_LIMIT_WINDOW_SEC);
      if (
        !sendLimitOrRedis(req, res, dpUser, {
          retryAfterSec: RATE_LIMIT_WINDOW_SEC,
          event: "rate_limit_deploy_prepare",
          message: "Deploy prepare rate limit exceeded.",
        })
      ) {
        return;
      }
    }
  }

  const limIpMain = getLimiter(redis, RATE_LIMIT_MAX_IP, RATE_LIMIT_WINDOW_SEC, "ip");
  const ipOutcome = await checkLimit(limIpMain, ip, RATE_LIMIT_WINDOW_SEC);
  if (
    !sendLimitOrRedis(req, res, ipOutcome, {
      retryAfterSec: RATE_LIMIT_WINDOW_SEC,
      event: "rate_limit",
      message: "Rate limit exceeded. Try again later.",
    })
  ) {
    return;
  }

  if (isLlmKeysPost) {
    const limLlmIp = getLimiter(redis, RATE_LIMIT_LLM_KEYS_MAX_IP, RATE_LIMIT_WINDOW_SEC, "llm-ip");
    const llmIp = await checkLimit(limLlmIp, ip, RATE_LIMIT_WINDOW_SEC);
    if (
      !sendLimitOrRedis(req, res, llmIp, {
        retryAfterSec: RATE_LIMIT_WINDOW_SEC,
        event: "rate_limit_llm_keys",
        message: "LLM keys endpoint rate limit exceeded. Try again later.",
      })
    ) {
      return;
    }
  }

  if (userId) {
    const userMax = isLlmKeysPost ? RATE_LIMIT_LLM_KEYS_MAX_USER : RATE_LIMIT_MAX_USER;
    const name = isLlmKeysPost ? "llm-user" : "user";
    const limUser = getLimiter(redis, userMax, RATE_LIMIT_WINDOW_SEC, name);
    const userOutcome = await checkLimit(limUser, userId, RATE_LIMIT_WINDOW_SEC);
    if (
      !sendLimitOrRedis(req, res, userOutcome, {
        retryAfterSec: RATE_LIMIT_WINDOW_SEC,
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
  console.warn("[security]", JSON.stringify(payload));
}
