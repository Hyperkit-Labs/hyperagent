/**
 * authMiddleware: public path behavior (liveness must not require JWT).
 * These tests call the middleware directly so they stay green in sandboxed
 * environments that forbid opening ephemeral sockets.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware, type RequestWithUser } from "./auth.js";

type JsonBody = Record<string, unknown>;

function createReq(path: string, authorization?: string): RequestWithUser {
  return {
    originalUrl: path,
    path,
    baseUrl: "",
    url: path,
    headers: authorization ? { authorization } : {},
  } as RequestWithUser;
}

function createRes() {
  const payload = {
    statusCode: 200,
    body: undefined as JsonBody | undefined,
  };

  const res = {
    status(code: number) {
      payload.statusCode = code;
      return this;
    },
    json(body: JsonBody) {
      payload.body = body;
      return this;
    },
  } as unknown as Response;

  return { res, payload };
}

function runAuth(path: string, authorization?: string) {
  const req = createReq(path, authorization);
  const { res, payload } = createRes();
  const next = vi.fn<NextFunction>();

  authMiddleware(req, res, next);

  return { req, next, payload };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = "unit-test-secret";
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_AUTH = "true";
  });

  it("allows /health/live without Authorization", () => {
    const { next, payload } = runAuth("/health/live");
    expect(next).toHaveBeenCalledOnce();
    expect(payload.statusCode).toBe(200);
    expect(payload.body).toBeUndefined();
  });

  it("allows /api/v1/health/live without Authorization", () => {
    const { next, payload } = runAuth("/api/v1/health/live");
    expect(next).toHaveBeenCalledOnce();
    expect(payload.statusCode).toBe(200);
    expect(payload.body).toBeUndefined();
  });

  it("allows /api/v1/config without Authorization", () => {
    const { next, payload } = runAuth("/api/v1/config");
    expect(next).toHaveBeenCalledOnce();
    expect(payload.statusCode).toBe(200);
    expect(payload.body).toBeUndefined();
  });

  it("allows legacy /config and /platform/track-record without Authorization", () => {
    const a = runAuth("/config");
    expect(a.next).toHaveBeenCalledOnce();
    const b = runAuth("/platform/track-record");
    expect(b.next).toHaveBeenCalledOnce();
  });

  it("allows legacy /networks and /tokens/stablecoins without Authorization", () => {
    const a = runAuth("/networks");
    expect(a.next).toHaveBeenCalledOnce();
    const b = runAuth("/tokens/stablecoins");
    expect(b.next).toHaveBeenCalledOnce();
  });

  it("rejects protected paths without Authorization", () => {
    const { next, payload } = runAuth("/api/v1/workflows");
    expect(next).not.toHaveBeenCalled();
    expect(payload.statusCode).toBe(401);
    expect(payload.body).toEqual({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
  });
});
