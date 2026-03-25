/**
 * Ensures /health and /health/live bypass Redis requirement so probes work when REDIS_URL is unset.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Response, NextFunction } from "express";

const savedNodeEnv = process.env.NODE_ENV;
const savedRedisUrl = process.env.REDIS_URL;

describe("rateLimitMiddleware health bypass", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.REDIS_URL = "";
  });

  afterEach(() => {
    process.env.NODE_ENV = savedNodeEnv;
    if (savedRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = savedRedisUrl;
  });

  it("calls next() for /health without Redis in production", async () => {
    const { rateLimitMiddleware } = await import("./rateLimit.js");
    const next = vi.fn() as NextFunction;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await rateLimitMiddleware(
      { path: "/health", requestId: "t1" } as Parameters<typeof rateLimitMiddleware>[0],
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for /health/live without Redis in production", async () => {
    const { rateLimitMiddleware } = await import("./rateLimit.js");
    const next = vi.fn() as NextFunction;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await rateLimitMiddleware(
      { path: "/health/live", requestId: "t2" } as Parameters<typeof rateLimitMiddleware>[0],
      res,
      next
    );
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
