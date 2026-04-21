/**
 * authMiddleware: public path behavior (liveness must not require JWT).
 * These tests call the middleware directly so they stay green in sandboxed
 * environments that forbid opening ephemeral sockets.
 */
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, type RequestWithUser } from "./auth.js";

type JsonBody = Record<string, unknown>;

function createReq(
  path: string,
  authorization?: string,
  cookie?: string,
): RequestWithUser {
  const headers: Record<string, string> = {};
  if (authorization) headers.authorization = authorization;
  if (cookie) headers.cookie = cookie;
  return {
    originalUrl: path,
    path,
    baseUrl: "",
    url: path,
    headers,
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

function runAuth(path: string, authorization?: string, cookie?: string) {
  const req = createReq(path, authorization, cookie);
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
    expect(verifySpy).toHaveBeenCalledWith("test-token", "unit-test-key");
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
    expect(payload.body).toEqual({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
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
    expect(verifySpy).toHaveBeenCalledWith("cookie-token", "unit-test-key");
    verifySpy.mockRestore();
  });
});
