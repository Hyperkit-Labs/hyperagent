/**
 * Ensures /health and /health/live bypass Upstash REST requirement so probes work when REST env is unset.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimitMiddleware } from "./rateLimit.js";
import type { Response, NextFunction } from "express";

const savedRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const savedRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const savedNodeEnv = process.env.NODE_ENV;

describe("rateLimitMiddleware health bypass", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.NODE_ENV = "production";
  });

  afterEach(() => {
    if (savedRestUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = savedRestUrl;
    if (savedRestToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = savedRestToken;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    vi.restoreAllMocks();
  });

  it("calls next() for /health without Upstash REST in production", async () => {
    const next = vi.fn() as NextFunction;
    await rateLimitMiddleware(
      { path: "/health", requestId: "t1" } as Parameters<typeof rateLimitMiddleware>[0],
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() for /health/live without Upstash REST in production", async () => {
    const next = vi.fn() as NextFunction;
    await rateLimitMiddleware(
      { path: "/health/live", requestId: "t2" } as Parameters<typeof rateLimitMiddleware>[0],
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() for /health/signin without Upstash REST in production", async () => {
    const next = vi.fn() as NextFunction;
    await rateLimitMiddleware(
      { path: "/health/signin", requestId: "t3" } as Parameters<typeof rateLimitMiddleware>[0],
      {} as Response,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
