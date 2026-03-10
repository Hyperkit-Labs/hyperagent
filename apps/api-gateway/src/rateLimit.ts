/**
 * Redis-backed rate limit. Security is mandatory; rate limiting protects against abuse.
 * Key pattern: rl:ip:{ip}, rl:user:{userId}. Window 60s; max 100 per window (configurable).
 *
 * Production: REDIS_URL is required at startup. When Redis is unreachable at runtime,
 * requests are rejected (fail-closed) to avoid unmitigated abuse.
 */
import { Response, NextFunction } from "express";
import { RequestWithId } from "./requestId.js";
import { RequestWithUser } from "./auth.js";

const REDIS_URL = process.env.REDIS_URL;
const NODE_ENV = process.env.NODE_ENV || "development";
/** When true, allow requests through when Redis is unreachable (skip rate limit). Use for local/staging when Redis is unavailable. */
const RATE_LIMIT_BYPASS_ON_FAIL = process.env.RATE_LIMIT_BYPASS_ON_FAIL === "true";
const RATE_LIMIT_WINDOW_SEC = Number(process.env.RATE_LIMIT_WINDOW_SEC) || 60;
/** Multiplier applied to all rate limits. Use 2 to double limits, 0.5 to halve. Default 1. */
const RATE_LIMIT_MULTIPLIER = Math.max(0.1, Number(process.env.RATE_LIMIT_MULTIPLIER) || 1);

const RATE_LIMIT_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_MAX_IP) || 300) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_MAX_USER) || 500) * RATE_LIMIT_MULTIPLIER);

/** Stricter limit for POST llm-keys to prevent key-stuffing attacks. Window 60s. */
const LLM_KEYS_PATH = "/api/v1/workspaces/current/llm-keys";
const RATE_LIMIT_LLM_KEYS_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_IP) || 10) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_LLM_KEYS_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_USER) || 5) * RATE_LIMIT_MULTIPLIER);

/** Stricter limit for workflow run start (POST /api/v1/workflows/generate). */
const RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP) || 20) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER) || 30) * RATE_LIMIT_MULTIPLIER);

/** Stricter limit for deploy prepare (POST /api/v1/workflows/:id/deploy/prepare). */
const RATE_LIMIT_DEPLOY_PREPARE_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_DEPLOY_PREPARE_MAX_IP) || 30) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_DEPLOY_PREPARE_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_DEPLOY_PREPARE_MAX_USER) || 50) * RATE_LIMIT_MULTIPLIER);

/** Auth bootstrap: strict per-IP limit to prevent brute force. No auth yet so IP-only. */
const BOOTSTRAP_PATH = "/api/v1/auth/bootstrap";
const RATE_LIMIT_BOOTSTRAP_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_BOOTSTRAP_MAX_IP) || Number(process.env.RATE_LIMIT_SIWE_MAX_IP) || 5) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_BOOTSTRAP_WINDOW_SEC = Number(process.env.RATE_LIMIT_SIWE_WINDOW_SEC) || Number(process.env.RATE_LIMIT_BOOTSTRAP_WINDOW_SEC) || 60;

/** Lightweight reads (GET /config, /networks, /tokens/stablecoins). Tiered: strict IP for unauthenticated, user-based for authenticated. */
const RATE_LIMIT_LIGHT_MAX_IP = Math.round((Number(process.env.RATE_LIMIT_LIGHT_MAX_IP) || 100) * RATE_LIMIT_MULTIPLIER);
const RATE_LIMIT_LIGHT_MAX_USER = Math.round((Number(process.env.RATE_LIMIT_LIGHT_MAX_USER) || 500) * RATE_LIMIT_MULTIPLIER);

/** After Redis failure, skip reconnects for this many ms to avoid log spam. */
const REDIS_BACKOFF_MS = 60_000;

let redis: { incr(key: string): Promise<number>; expire(key: string, sec: number): Promise<string>; disconnect?: () => void } | null = null;
let lastRedisFailure = 0;

async function getRedis(): Promise<typeof redis> {
  const url = (REDIS_URL || "").trim();
  if (!url || url.startsWith("#")) return null;
  if (Date.now() - lastRedisFailure < REDIS_BACKOFF_MS) return null;
  if (redis) return redis;
  try {
    const mod = await import("ioredis");
    const RedisClient = (mod as unknown as { default: new (url: string, opts?: object) => { incr(key: string): Promise<number>; expire(key: string, sec: number): Promise<string>; disconnect?: () => void; on?(event: string, fn: (err: Error) => void): void } }).default;
    const opts: Record<string, unknown> = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 15000,
      retryStrategy: (times: number) => (times <= 3 ? Math.min(times * 500, 2000) : null),
    };
    if (url.startsWith("rediss://")) {
      opts.tls = { rejectUnauthorized: process.env.REDIS_TLS_VERIFY !== "false" };
    }
    const client = new RedisClient(url, opts);
    client.on?.("error", () => {
      lastRedisFailure = Date.now();
      redis = null;
      if (typeof client.disconnect === "function") client.disconnect();
    });
    redis = client;
    return redis;
  } catch (err) {
    lastRedisFailure = Date.now();
    if (NODE_ENV === "development") {
      console.warn("[rate-limit] Redis unreachable, skipping rate limit. Set REDIS_URL to empty for quiet mode.");
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[rate-limit] Redis connection failed:", msg, "URL format: use rediss:// for TLS (Supabase/Redis Cloud)");
    }
    return null;
  }
}

async function checkLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<boolean> {
  const r = await getRedis();
  if (!r) {
    if (NODE_ENV === "production") return false;
    return true;
  }
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSec);
    return count <= max;
  } catch (err) {
    lastRedisFailure = Date.now();
    const r = redis;
    redis = null;
    if (typeof r?.disconnect === "function") r.disconnect();
    if (NODE_ENV === "production") {
      console.error("[rate-limit] Redis check failed for key=%s: %s", key, err instanceof Error ? err.message : err);
      return false;
    }
    console.warn("[rate-limit] Redis check failed, skipping rate limit for 60s:", err instanceof Error ? err.message : err);
    return true;
  }
}

export type RateLimitRequest = RequestWithId & RequestWithUser;

export async function rateLimitMiddleware(
  req: RateLimitRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const url = (REDIS_URL || "").trim();
  if (!url || url.startsWith("#")) {
    if (NODE_ENV === "production") {
      logSecurityEvent("rate_limit_unavailable", 503, req.path, req.requestId, req.userId);
      res.status(503).json({
        error: "Service Unavailable",
        message: "Rate limiting required. REDIS_URL must be set in production.",
        requestId: req.requestId,
      });
      return;
    }
    next();
    return;
  }
  if (req.path === "/health") {
    next();
    return;
  }
  const isBootstrap = req.method === "POST" && req.path === BOOTSTRAP_PATH;
  if (isBootstrap) {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const bootstrapKey = `rl:ip:${ip}:bootstrap`;
    const bootstrapOk = await checkLimit(bootstrapKey, RATE_LIMIT_BOOTSTRAP_MAX_IP, RATE_LIMIT_BOOTSTRAP_WINDOW_SEC);
    if (!bootstrapOk) {
      logSecurityEvent("rate_limit_bootstrap", 429, req.path, req.requestId, undefined);
      res.setHeader("Retry-After", String(RATE_LIMIT_BOOTSTRAP_WINDOW_SEC));
      res.status(429).json({
        error: "Too Many Requests",
        message: "Too many sign-in attempts. Try again later.",
        requestId: req.requestId,
      });
      return;
    }
    next();
    return;
  }
  const isLightweightRead =
    req.method === "GET" &&
    (req.path === "/api/v1/config" || req.path === "/api/v1/config/integrations-debug" || req.path === "/api/v1/networks" || req.path === "/api/v1/tokens/stablecoins");
  if (isLightweightRead) {
    const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const userId = req.userId || "";

    // Tiered: authenticated users get user-based limit; unauthenticated get strict IP limit
    if (userId) {
      const userKey = `rl:user:${userId}:light`;
      const userOk = await checkLimit(userKey, RATE_LIMIT_LIGHT_MAX_USER, RATE_LIMIT_WINDOW_SEC);
      if (!userOk) {
        logSecurityEvent("rate_limit_light", 429, req.path, req.requestId, userId);
        res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
        res.status(429).json({
          error: "Too Many Requests",
          message: "Config/networks rate limit exceeded. Try again later.",
          requestId: req.requestId,
        });
        return;
      }
    } else {
      const lightKey = `rl:ip:${ip}:light`;
      const lightOk = await checkLimit(lightKey, RATE_LIMIT_LIGHT_MAX_IP, RATE_LIMIT_WINDOW_SEC);
      if (!lightOk) {
        logSecurityEvent("rate_limit_light", 429, req.path, req.requestId, undefined);
        res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
        res.status(429).json({
          error: "Too Many Requests",
          message: "Config/networks rate limit exceeded. Try again later.",
          requestId: req.requestId,
        });
        return;
      }
    }
    next();
    return;
  }
  if (NODE_ENV === "production") {
    const r = await getRedis();
    if (!r) {
      if (RATE_LIMIT_BYPASS_ON_FAIL) {
        console.warn("[rate-limit] Redis unreachable, bypassing rate limit (RATE_LIMIT_BYPASS_ON_FAIL=true)");
        next();
        return;
      }
      logSecurityEvent("rate_limit_unavailable", 503, req.path, req.requestId, req.userId);
      res.status(503).json({
        error: "Service Unavailable",
        message: "Rate limiting unavailable. Redis connection failed. Ensure REDIS_URL is set and reachable (use rediss:// for TLS). Set RATE_LIMIT_BYPASS_ON_FAIL=true to bypass when Redis is unavailable.",
        requestId: req.requestId,
      });
      return;
    }
  }
  const ip = req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const userId = req.userId || "";
  const isLlmKeysPost = req.method === "POST" && req.path === LLM_KEYS_PATH;
  const isWorkflowGenerate = req.method === "POST" && req.path === "/api/v1/workflows/generate";
  const isDeployPrepare = req.method === "POST" && /^\/api\/v1\/workflows\/[^/]+\/deploy\/prepare$/.test(req.path);

  if (isWorkflowGenerate) {
    const key = `rl:ip:${ip}:workflow-generate`;
    const ok = await checkLimit(key, RATE_LIMIT_WORKFLOW_GENERATE_MAX_IP, RATE_LIMIT_WINDOW_SEC);
    if (!ok) {
      logSecurityEvent("rate_limit_workflow_generate", 429, req.path, req.requestId, userId || undefined);
      res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
      res.status(429).json({
        error: "Too Many Requests",
        message: "Workflow start rate limit exceeded. Try again later.",
        requestId: req.requestId,
      });
      return;
    }
    if (userId) {
      const userKey = `rl:user:${userId}:workflow-generate`;
      const userOk = await checkLimit(userKey, RATE_LIMIT_WORKFLOW_GENERATE_MAX_USER, RATE_LIMIT_WINDOW_SEC);
      if (!userOk) {
        logSecurityEvent("rate_limit_workflow_generate", 429, req.path, req.requestId, userId);
        res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
        res.status(429).json({
          error: "Too Many Requests",
          message: "Workflow start rate limit exceeded.",
          requestId: req.requestId,
        });
        return;
      }
    }
  }

  if (isDeployPrepare) {
    const key = `rl:ip:${ip}:deploy-prepare`;
    const ok = await checkLimit(key, RATE_LIMIT_DEPLOY_PREPARE_MAX_IP, RATE_LIMIT_WINDOW_SEC);
    if (!ok) {
      logSecurityEvent("rate_limit_deploy_prepare", 429, req.path, req.requestId, userId || undefined);
      res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
      res.status(429).json({
        error: "Too Many Requests",
        message: "Deploy prepare rate limit exceeded. Try again later.",
        requestId: req.requestId,
      });
      return;
    }
    if (userId) {
      const userKey = `rl:user:${userId}:deploy-prepare`;
      const userOk = await checkLimit(userKey, RATE_LIMIT_DEPLOY_PREPARE_MAX_USER, RATE_LIMIT_WINDOW_SEC);
      if (!userOk) {
        logSecurityEvent("rate_limit_deploy_prepare", 429, req.path, req.requestId, userId);
        res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
        res.status(429).json({
          error: "Too Many Requests",
          message: "Deploy prepare rate limit exceeded.",
          requestId: req.requestId,
        });
        return;
      }
    }
  }

  const ipKey = `rl:ip:${ip}`;
  const ipOk = await checkLimit(ipKey, RATE_LIMIT_MAX_IP, RATE_LIMIT_WINDOW_SEC);
  if (!ipOk) {
    logSecurityEvent("rate_limit", 429, req.path, req.requestId, userId || undefined);
    res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      requestId: req.requestId,
    });
    return;
  }

  if (isLlmKeysPost) {
    const llmKeysIpKey = `rl:ip:${ip}:llm-keys`;
    const llmKeysIpOk = await checkLimit(llmKeysIpKey, RATE_LIMIT_LLM_KEYS_MAX_IP, RATE_LIMIT_WINDOW_SEC);
    if (!llmKeysIpOk) {
      logSecurityEvent("rate_limit_llm_keys", 429, req.path, req.requestId, userId || undefined);
      res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
      res.status(429).json({
        error: "Too Many Requests",
        message: "LLM keys endpoint rate limit exceeded. Try again later.",
        requestId: req.requestId,
      });
      return;
    }
  }

  if (userId) {
    const userKey = isLlmKeysPost ? `rl:user:${userId}:llm-keys` : `rl:user:${userId}`;
    const userMax = isLlmKeysPost ? RATE_LIMIT_LLM_KEYS_MAX_USER : RATE_LIMIT_MAX_USER;
    const userOk = await checkLimit(userKey, userMax, RATE_LIMIT_WINDOW_SEC);
    if (!userOk) {
      logSecurityEvent("rate_limit", 429, req.path, req.requestId, userId);
      res.setHeader("Retry-After", String(RATE_LIMIT_WINDOW_SEC));
      res.status(429).json({
        error: "Too Many Requests",
        message: "User rate limit exceeded.",
        requestId: req.requestId,
      });
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
