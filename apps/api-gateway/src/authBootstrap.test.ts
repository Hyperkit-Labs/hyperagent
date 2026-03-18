/**
 * Unit tests: auth bootstrap handler. 400/503/401 responses.
 */
import { beforeAll } from "vitest";
import express, { json } from "express";
import request from "supertest";

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
