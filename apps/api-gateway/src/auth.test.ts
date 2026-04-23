/**
 * authMiddleware: public path behavior (liveness must not require JWT) and
 * security/hardening regressions. These tests call the middleware directly so
 * they stay green in sandboxed environments that forbid opening ephemeral
 * sockets.
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __authFailureSampleForTest,
  __resetAuthFailureCountersForTest,
  authMiddleware,
  type RequestWithUser,
} from "./auth.js";

type JsonBody = Record<string, unknown>;

function createReq(
  path: string,
  authorization?: string,
  cookie?: string,
  remote?: string,
): RequestWithUser {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (cookie) headers.cookie = cookie;
  if (remote) headers["x-forwarded-for"] = remote;
  return {
    originalUrl: path,
    path,
    baseUrl: "",
    url: path,
    headers,
    ip: remote ?? "127.0.0.1",
  } as unknown as RequestWithUser;
}

interface ResPayload {
  statusCode: number;
  body?: JsonBody;
  headers: Record<string, string>;
}

function createRes() {
  const payload: ResPayload = {
    statusCode: 200,
    body: undefined,
    headers: {},
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
    setHeader(name: string, value: string | number | readonly string[]) {
      payload.headers[name] = Array.isArray(value) ? value.join(", ") : String(value);
      return this;
    },
  } as unknown as Response;

  return { res, payload };
}

function runAuth(
  path: string,
  authorization?: string,
  cookie?: string,
  remote?: string,
) {
  const req = createReq(path, authorization, cookie, remote);
  const { res, payload } = createRes();
  const next = vi.fn<NextFunction>();

  authMiddleware(req, res, next);

  return { req, next, payload };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = "unit-test-key";
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_AUTH = "true";
    __resetAuthFailureCountersForTest();
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

  it("sets request identity on public paths when auth is present", () => {
    const verifySpy = vi.spyOn(jwt, "verify").mockReturnValue({
      sub: "user-123",
      wallet_address: "0xabc",
    } as never);
    const authHeader = ["Bearer", "test-token"].join(" ");
    const { req, next, payload } = runAuth("/api/v1/config", authHeader);
    expect(next).toHaveBeenCalledOnce();
    expect(payload.statusCode).toBe(200);
    expect(req.userId).toBe("user-123");
    expect(req.walletAddress).toBe("0xabc");
    expect(verifySpy).toHaveBeenCalledWith(
      "test-token",
      "unit-test-key",
      expect.objectContaining({ algorithms: ["HS256"] }),
    );
    verifySpy.mockRestore();
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
    expect(payload.body).toMatchObject({
      error: "Unauthorized",
      code: "unauthorized.missing_credential",
      message: "Missing or invalid Authorization header",
    });
    expect(payload.headers["WWW-Authenticate"]).toContain("Bearer");
    expect(payload.headers["WWW-Authenticate"]).toContain(
      'error="invalid_request"',
    );
  });

  it("rejects protected paths with an invalid bearer token", () => {
    const verifySpy = vi.spyOn(jwt, "verify").mockImplementation(() => {
      throw new jwt.JsonWebTokenError("bad token");
    });
    const { next, payload } = runAuth(
      "/api/v1/workflows",
      "Bearer not-a-real-jwt",
    );
    expect(next).not.toHaveBeenCalled();
    expect(payload.statusCode).toBe(401);
    expect(payload.body).toMatchObject({
      error: "Unauthorized",
      code: "unauthorized.invalid_token",
      message: "Invalid or expired token",
    });
    expect(payload.headers["WWW-Authenticate"]).toContain(
      'error="invalid_token"',
    );
    verifySpy.mockRestore();
  });

  it("pins JWT verification to HS256 to prevent algorithm confusion", () => {
    const verifySpy = vi.spyOn(jwt, "verify").mockReturnValue({
      sub: "user-algo",
    } as never);
    runAuth("/api/v1/workflows", "Bearer good-token");
    expect(verifySpy).toHaveBeenCalledWith(
      "good-token",
      "unit-test-key",
      expect.objectContaining({ algorithms: ["HS256"] }),
    );
    verifySpy.mockRestore();
  });

  it("allows protected paths with rt cookie JWT when Authorization header is missing", () => {
    const verifySpy = vi.spyOn(jwt, "verify").mockReturnValue({
      sub: "user-cookie",
      wallet_address: "0xdef",
    } as never);
    const { req, next, payload } = runAuth(
      "/api/v1/workspaces/current/llm-keys",
      undefined,
      "rt=cookie-token; Path=/",
    );
    expect(next).toHaveBeenCalledOnce();
    expect(payload.statusCode).toBe(200);
    expect(req.userId).toBe("user-cookie");
    expect(req.walletAddress).toBe("0xdef");
    expect(verifySpy).toHaveBeenCalledWith(
      "cookie-token",
      "unit-test-key",
      expect.objectContaining({ algorithms: ["HS256"] }),
    );
    verifySpy.mockRestore();
  });

  it("samples repeated auth-failure logs from the same source", () => {
    const key = "10.0.0.1|401_missing_header|/api/v1/workflows";
    const now = 1_700_000_000_000;
    const results: { shouldLog: boolean; suppressed: number }[] = [];
    for (let i = 0; i < 200; i++) {
      results.push(__authFailureSampleForTest(key, now + i));
    }
    const logged = results.filter((r) => r.shouldLog);
    // Window lets the first 5 through, then emits a "suppressed=1" summary at
    // call #6, then silence until suppression crosses the summary threshold.
    expect(logged.length).toBeGreaterThanOrEqual(5);
    expect(logged.length).toBeLessThanOrEqual(10);
    // At least one emitted entry must carry the summary counter.
    expect(logged.some((r) => r.suppressed > 0)).toBe(true);
  });

  it("starts a fresh window after the sampling interval elapses", () => {
    const key = "10.0.0.2|401_missing_header|/api/v1/workflows";
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 50; i++) __authFailureSampleForTest(key, t0);
    const next = __authFailureSampleForTest(key, t0 + 60_001);
    expect(next.shouldLog).toBe(true);
    expect(next.suppressed).toBe(0);
  });
});
