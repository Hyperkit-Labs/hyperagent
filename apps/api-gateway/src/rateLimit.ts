/**
 * Optional Redis-backed rate limit. When REDIS_URL is set, limits by IP and optionally by userId.
 * Key pattern: rl:ip:{ip}, rl:user:{userId}. Window 60s; max 100 per window (configurable).
 *
 * Production: REDIS_URL is required. Without Redis, no rate limiting is applied (vulnerable to abuse).
 * See docs/PRODUCTION_DEPLOYMENT.md for production checklist.
 *
 * When Redis is unreachable (e.g. Docker cannot reach external Redis), rate limiting is skipped
 * and a backoff prevents log spam.
 */
import { Response, NextFunction } from "express";
import { RequestWithId } from "./requestId.js";
import { RequestWithUser } from "./auth.js";

const REDIS_URL = process.env.REDIS_URL;
const NODE_ENV = process.env.NODE_ENV || "development";
const RATE_LIMIT_WINDOW_SEC = Number(process.env.RATE_LIMIT_WINDOW_SEC) || 60;
const RATE_LIMIT_MAX_IP = Number(process.env.RATE_LIMIT_MAX_IP) || 100;
const RATE_LIMIT_MAX_USER = Number(process.env.RATE_LIMIT_MAX_USER) || 200;

/** Stricter limit for POST llm-keys to prevent key-stuffing attacks. Window 60s. */
const LLM_KEYS_PATH = "/api/v1/workspaces/current/llm-keys";
const RATE_LIMIT_LLM_KEYS_MAX_IP = Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_IP) || 10;
const RATE_LIMIT_LLM_KEYS_MAX_USER = Number(process.env.RATE_LIMIT_LLM_KEYS_MAX_USER) || 5;

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
    const client = new RedisClient(url, {
      maxRetriesPerRequest: 0,
      enableReadyCheck: true,
      connectTimeout: 5000,
    });
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
      console.error("[rate-limit] Redis connection failed:", err instanceof Error ? err.message : err);
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
  if (!r) return true;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSec);
    return count <= max;
  } catch (err) {
    lastRedisFailure = Date.now();
    const r = redis;
    redis = null;
    if (typeof r?.disconnect === "function") r.disconnect();
    if (NODE_ENV === "development") {
      console.warn("[rate-limit] Redis check failed, skipping rate limit for 60s:", err instanceof Error ? err.message : err);
    } else {
      console.error("[rate-limit] Redis check failed for key=%s: %s", key, err instanceof Error ? err.message : err);
    }
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
    next();
    return;
  }
  if (req.path === "/health") {
    next();
    return;
  }
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const userId = req.userId || "";
  const isLlmKeysPost = req.method === "POST" && req.path === LLM_KEYS_PATH;

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
