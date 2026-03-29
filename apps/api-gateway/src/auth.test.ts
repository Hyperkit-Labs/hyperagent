/**
 * authMiddleware: public path behavior (liveness must not require JWT).
 */
import { beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { authMiddleware } from "./auth.js";

describe("authMiddleware", () => {
  beforeEach(() => {
    process.env.AUTH_JWT_SECRET = "unit-test-secret";
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_AUTH = "true";
  });

  it("GET /health/live returns 200 without Authorization", async () => {
    const app = express();
    app.use(authMiddleware);
    app.get("/health/live", (_req, res) => {
      res.status(200).json({ status: "ok", gateway: true });
    });
    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/v1/health/live returns 200 without Authorization", async () => {
    const app = express();
    app.use(authMiddleware);
    app.get("/api/v1/health/live", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const res = await request(app).get("/api/v1/health/live");
    expect(res.status).toBe(200);
  });

  it("protected path returns 401 without Authorization", async () => {
    const app = express();
    app.use(authMiddleware);
    app.get("/api/v1/workflows", (_req, res) => res.status(200).send("ok"));
    const res = await request(app).get("/api/v1/workflows");
    expect(res.status).toBe(401);
  });
});
