/**
 * Unit tests: auth bootstrap handler. 400/503/401 responses.
 */
import { beforeAll, describe, expect, it } from "vitest";
import express, { json } from "express";
import request from "supertest";
import { isMissingTableError, isValidEip191SignatureHex } from "./authBootstrap.js";

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

describe("isValidEip191SignatureHex", () => {
  const valid65 =
    "0x" +
    "43".repeat(32) +
    "43".repeat(32) +
    "1b";

  it("accepts 0x + 130 hex chars", () => {
    expect(isValidEip191SignatureHex(valid65)).toBe(true);
  });

  it("rejects short test signatures like 0xdeadbeef", () => {
    expect(isValidEip191SignatureHex("0xdeadbeef")).toBe(false);
  });

  it("rejects empty or wrong length", () => {
    expect(isValidEip191SignatureHex("0x")).toBe(false);
    expect(isValidEip191SignatureHex("0x" + "ab".repeat(64))).toBe(false);
  });
});

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
    expect(res.body.code).toBe("INVALID_AUTH_METHOD");
  });

  it("returns 503 when AUTH_JWT_SECRET not configured", async () => {
    const app = await getApp();
    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ authMethod: "siwe", siwePayload: { message: "x", signature: "0x" } });
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/Auth not configured|Supabase not configured/);
    expect(["AUTH_NOT_CONFIGURED", "SUPABASE_NOT_CONFIGURED"]).toContain(res.body.code);
  });
});
