/**
 * HyperAgent API Gateway
 * Versioned proxy /api/v1 to orchestrator; legacy /run, /runs.
 * Required: JWT auth (AUTH_JWT_SECRET), Redis rate limit (REDIS_URL). Security is mandatory.
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root when running locally (pnpm start from apps/api-gateway)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import cors from "cors";
import express from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import rateLimit from "express-rate-limit";
import { requestIdMiddleware, RequestWithId } from "./requestId.js";
import { otelRequestSpanMiddleware, getTraceparentHeader } from "@hyperagent/backend-middleware";
import { authMiddleware, RequestWithUser } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import { authBootstrapHandler, getSupabaseAdmin } from "./authBootstrap.js";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";
const NODE_ENV = process.env.NODE_ENV || "development";
const REDIS_URL = process.env.REDIS_URL;

/** Upstream timeout (ms). If orchestrator does not respond, gateway returns 502 instead of hanging.
 * Default 25s kills SSE during long builds. Set PROXY_TIMEOUT_MS=660000 for real-time terminal (10+ min). */
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 25_000;

if (NODE_ENV === "production" && !REDIS_URL) {
  console.error("[API Gateway] Production requires REDIS_URL for rate limiting. Set REDIS_URL or start will be refused.");
  process.exit(1);
}

const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;
if (NODE_ENV === "production" && !AUTH_JWT_SECRET) {
  console.error("[API Gateway] Production requires AUTH_JWT_SECRET. Unauthenticated access is not allowed. Set AUTH_JWT_SECRET.");
  process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** In development, allow local network origins (192.168.x.x, 10.x.x.x) for Studio accessed via network URL. */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (NODE_ENV === "development") {
    try {
      const u = new URL(origin);
      const host = u.hostname;
      if (host === "localhost" || host === "127.0.0.1") return true;
      if (host.startsWith("192.168.") || host.startsWith("10.")) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

const app = express();

// Trust first proxy hop (Coolify/Traefik) so req.ip and X-Forwarded-For resolve to real client IP.
// Without this, all requests appear as the proxy's internal Docker IP.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// Body parsing is NOT applied globally. Proxy routes need the raw request stream intact.
// Only non-proxied routes (auth bootstrap, health) use express.json() via per-route middleware.
const jsonParser = express.json({ limit: "2mb" });

app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(authMiddleware);
app.use((req, res, next) => {
  (rateLimitMiddleware as (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>)(req, res, next).catch(next);
});

function proxyOptions(): Record<string, unknown> {
  return {
    target: ORCHESTRATOR_URL,
    changeOrigin: true,
    selfHandleResponse: true,
    logLevel: "silent",
    onProxyReq(proxyReq: import("http").ClientRequest, req: express.Request) {
      const r = req as express.Request & RequestWithId & RequestWithUser;
      proxyReq.setTimeout(PROXY_TIMEOUT_MS, () => {
        proxyReq.destroy();
      });
      if (r.requestId) proxyReq.setHeader("x-request-id", r.requestId);
      const traceparent = getTraceparentHeader() || (r.headers.traceparent as string);
      if (traceparent) proxyReq.setHeader("traceparent", traceparent);
      if (r.headers.authorization) proxyReq.setHeader("authorization", r.headers.authorization);
      if (r.headers["x-agent-session"]) proxyReq.setHeader("x-agent-session", r.headers["x-agent-session"] as string);
      proxyReq.removeHeader("x-user-id");
      proxyReq.removeHeader("X-User-Id");
      if (r.userId) proxyReq.setHeader("x-user-id", r.userId);
    },
    onError(err: Error, req: express.Request, res: express.Response) {
      const id = (req as RequestWithId).requestId;
      console.error(`[gateway] proxy error path=${req.path} requestId=${id}`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Bad Gateway", message: "Backend unavailable. Try again or check server logs.", requestId: id ?? undefined });
      }
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const status = proxyRes.statusCode ?? 0;
      const expressReq = req as express.Request & RequestWithId;
      const id = expressReq.requestId;
      const path = "path" in expressReq ? expressReq.path : (expressReq as { url?: string }).url ?? "";
      if (status >= 500) {
        console.error(`[gateway] upstream 5xx path=${path} status=${status} requestId=${id}`);
        const body = JSON.stringify({
          error: status === 504 ? "Gateway Timeout" : "Bad Gateway",
          message: status === 504 ? "Backend timed out. Try again." : "Backend error. Try again or check server logs.",
          requestId: id ?? undefined,
        });
        res.statusCode = status === 504 ? 504 : 502;
        res.setHeader("Content-Type", "application/json");
        return body;
      }
      return responseBuffer;
    }),
  };
}

// Single auth entrypoint: SIWE and thirdweb OAuth/in-app. Both upsert wallet_users and issue session JWT.
const authBootstrapRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth bootstrap requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.post("/api/v1/auth/bootstrap", authBootstrapRateLimiter, jsonParser, authBootstrapHandler);

// Primary: versioned API (proxied; raw body stream forwarded to orchestrator)
app.use("/api/v1", createProxyMiddleware(proxyOptions()));
// Legacy (deprecated)
app.use("/run", createProxyMiddleware(proxyOptions()));
app.use("/runs", createProxyMiddleware(proxyOptions()));
// Catch-all /api for backward compatibility
app.use("/api", createProxyMiddleware(proxyOptions()));

// OpenAPI docs (Swagger UI) and schema
app.use("/docs", createProxyMiddleware(proxyOptions()));
app.use("/openapi.json", createProxyMiddleware(proxyOptions()));

/** Liveness probe: always 200 if the process is up. Use for K8s/Docker liveness checks. */
app.get("/health/live", (_req, res) => {
  res.json({ status: "ok", gateway: true });
});

/**
 * Dependency-aware health: must match what POST /api/v1/auth/bootstrap needs.
 * Previously orchestrator-only could pass while bootstrap returned 503 (no Supabase/JWT), misleading the login page.
 */
app.get("/health", async (_req, res) => {
  const authJwtConfigured = Boolean(process.env.AUTH_JWT_SECRET);
  /** OAuth / in-app wallet verification; SIWE-only sign-in can still work without this. */
  const thirdwebSecretConfigured = Boolean(process.env.THIRDWEB_SECRET_KEY?.trim());
  const supabase = getSupabaseAdmin();
  let dbOk = false;
  let dbError: string | null = null;
  if (supabase) {
    const dbCheck = await supabase.from("wallet_users").select("id").limit(1);
    dbError = dbCheck.error ? (dbCheck.error as { message?: string }).message ?? String(dbCheck.error) : null;
    dbOk = !dbCheck.error;
  } else {
    dbError = "Supabase not configured";
  }

  /** Same gates as authBootstrapHandler before issuing a session. */
  const authSigninReady = authJwtConfigured && Boolean(supabase) && dbOk;

  let orchestratorOk = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`${ORCHESTRATOR_URL.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    orchestratorOk = r.ok;
  } catch {
    orchestratorOk = false;
  }

  const criticalOk = orchestratorOk && authSigninReady;
  if (!criticalOk) {
    let msg: string;
    if (!orchestratorOk) {
      msg = "Orchestrator unreachable. Check ORCHESTRATOR_URL and backend status.";
    } else if (!authJwtConfigured) {
      msg = "Auth not configured (AUTH_JWT_SECRET missing). Sign-in unavailable.";
    } else if (!supabase) {
      msg = "Supabase not configured. Sign-in unavailable.";
    } else if (!dbOk) {
      msg = `Database unreachable. ${dbError ?? "Check Supabase credentials and migrations."}`;
    } else {
      msg = "Service degraded.";
    }
    res.status(503).json({
      status: "degraded",
      gateway: true,
      orchestrator_ok: orchestratorOk,
      auth_jwt_configured: authJwtConfigured,
      thirdweb_secret_configured: thirdwebSecretConfigured,
      supabase_configured: Boolean(supabase),
      db_connected: dbOk,
      db_error: dbError,
      auth_signin_ready: authSigninReady,
      message: msg,
    });
    return;
  }

  res.json({
    status: "ok",
    gateway: true,
    orchestrator_ok: true,
    auth_jwt_configured: true,
    thirdweb_secret_configured: thirdwebSecretConfigured,
    supabase_configured: true,
    db_connected: true,
    auth_signin_ready: true,
  });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[API Gateway] listening on ${port}, forwarding to ${ORCHESTRATOR_URL}`);
});
