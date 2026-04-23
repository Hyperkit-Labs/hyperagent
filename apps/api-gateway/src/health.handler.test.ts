import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./authBootstrap.js", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ error: null, data: [{ id: "1" }] }),
      }),
    }),
  }),
}));

vi.mock("@hyperagent/config", () => ({
  getGatewayEnv: vi.fn(() => ({
    auth: { jwtSecret: "s" },
    bootstrap: { thirdwebSecretKey: "t" },
  })),
}));

import { getGatewayEnv } from "@hyperagent/config";
import { healthHandler } from "./health.js";

type JsonBody = Record<string, unknown>;

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

describe("healthHandler", () => {
  const orchUrl = "http://127.0.0.1:9";

  beforeEach(() => {
    vi.mocked(getGatewayEnv).mockReturnValue({
      auth: { jwtSecret: "s" },
      bootstrap: { thirdwebSecretKey: "t" },
    } as ReturnType<typeof getGatewayEnv>);
  });

  it("returns 200 when auth and orchestrator /health are OK", async () => {
    global.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/health/live")) {
        return new Response(null, { status: 200 });
      }
      if (u.endsWith("/health")) {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const { res, payload } = createRes();
    const h = healthHandler(orchUrl);
    await h({} as Request, res);
    expect(payload.statusCode).toBe(200);
    expect(payload.body?.status).toBe("ok");
    expect(payload.body?.pipeline_ready).toBe(true);
  });

  it("returns 503 when orchestrator /health is not OK", async () => {
    global.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/health/live")) {
        return new Response(null, { status: 200 });
      }
      if (u.endsWith("/health")) {
        return new Response(JSON.stringify({ status: "degraded" }), {
          status: 503,
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const { res, payload } = createRes();
    const h = healthHandler(orchUrl);
    await h({} as Request, res);
    expect(payload.statusCode).toBe(503);
    expect(payload.body?.orchestrator_ok).toBe(false);
    expect(payload.body?.pipeline_ready).toBe(false);
  });

  it("returns 503 when AUTH_JWT_SECRET is not configured", async () => {
    vi.mocked(getGatewayEnv).mockReturnValue({
      auth: { jwtSecret: "" },
      bootstrap: { thirdwebSecretKey: "t" },
    } as ReturnType<typeof getGatewayEnv>);

    global.fetch = vi.fn() as typeof fetch;

    const { res, payload } = createRes();
    const h = healthHandler(orchUrl);
    await h({} as Request, res);
    expect(payload.statusCode).toBe(503);
    expect(payload.body?.auth_signin_ready).toBe(false);
  });

  it("shallow: returns 200 when only orchestrator /health/live is OK (no deep /health call)", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/health/live")) {
        return new Response(null, { status: 200 });
      }
      if (u.endsWith("/health")) {
        return new Response(JSON.stringify({ status: "degraded" }), { status: 503 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    global.fetch = fetchMock;

    const { res, payload } = createRes();
    const h = healthHandler(orchUrl, { shallowOrchestrator: true });
    await h({} as Request, res);
    expect(payload.statusCode).toBe(200);
    expect(payload.body?.status).toBe("ok");
    expect(payload.body?.signin_shallow_orchestrator_probe).toBe(true);
    const orchUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(orchUrls.some((u) => u.includes("/health/live"))).toBe(true);
    expect(orchUrls.some((u) => u.endsWith("/health") && !u.includes("/health/live"))).toBe(false);
  });

  it("shallow: returns 503 when /health/live is not OK", async () => {
    global.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/health/live")) {
        return new Response(null, { status: 503 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const { res, payload } = createRes();
    const h = healthHandler(orchUrl, { shallowOrchestrator: true });
    await h({} as Request, res);
    expect(payload.statusCode).toBe(503);
    expect(payload.body?.orchestrator_ok).toBe(false);
  });
});
