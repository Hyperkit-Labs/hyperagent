/**
 * Unit tests: auth bootstrap handler. 400/503/401 responses.
 */
import { beforeAll, describe, expect, it } from "vitest";
import express, { json } from "express";
import request from "supertest";
import { isMissingTableError } from "./authBootstrap.js";

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = "";
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_KEY = "";
});

async function getApp() {
  const { authBootstrapHandler } = await import("./authBootstrap.js");
  const app = express();
  app.use(json({ limit: "2mb" }));
  app.all("/api/v1/auth/bootstrap", authBootstrapHandler);
  return app;
}

describe("isMissingTableError", () => {
  it("is true for undefined relation (missing migration)", () => {
    expect(isMissingTableError('relation "wallet_users" does not exist', undefined)).toBe(true);
    expect(isMissingTableError("relation \"public.wallet_users\" does not exist", "42P01")).toBe(true);
  });

  it("is false when message mentions wallet_users but table exists (RLS / permission)", () => {
    expect(
      isMissingTableError(
        'new row violates row-level security policy for table "wallet_users"',
        undefined
      )
    ).toBe(false);
    expect(isMissingTableError("permission denied for table wallet_users", undefined)).toBe(false);
  });

  it("is true when Postgres code is 42P01", () => {
    expect(isMissingTableError("relation missing", "42P01")).toBe(true);
  });

  it("is false for undefined message and code", () => {
    expect(isMissingTableError(undefined, undefined)).toBe(false);
  });
});

describe("authBootstrapHandler", () => {
  it("returns 405 for GET", async () => {
    const app = await getApp();
    const res = await request(app).get("/api/v1/auth/bootstrap");
    expect(res.status).toBe(405);
  });

  it("returns 400 when authMethod is invalid", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ authMethod: "invalid" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("siwe");
  });

  it("returns 503 when AUTH_JWT_SECRET not configured", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ authMethod: "siwe", siwePayload: { message: "x", signature: "0x" } });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Auth not configured|Supabase not configured/);
  });
});
