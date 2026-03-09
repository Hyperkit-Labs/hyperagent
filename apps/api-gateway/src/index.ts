/**
 * HyperAgent API Gateway
 * Versioned proxy /api/v1 to orchestrator; legacy /run, /runs.
 * Required: JWT auth (AUTH_JWT_SECRET), Redis rate limit (REDIS_URL). Security is mandatory.
 */
import cors from "cors";
import express from "express";
import { createProxyMiddleware, responseInterceptor } from "http-proxy-middleware";
import { requestIdMiddleware, RequestWithId } from "./requestId.js";
import { authMiddleware, RequestWithUser } from "./auth.js";
import { rateLimitMiddleware } from "./rateLimit.js";
import { siweAuthHandler } from "./siweAuth.js";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";
const NODE_ENV = process.env.NODE_ENV || "development";
const REDIS_URL = process.env.REDIS_URL;

/** Upstream timeout (ms). If orchestrator does not respond, gateway returns 502 instead of hanging. */
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
// Only non-proxied routes (SIWE, health) use express.json() via per-route middleware.
const jsonParser = express.json({ limit: "2mb" });

app.use(requestIdMiddleware);
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

// SIWE: wallet sign-in (public, no auth). Needs parsed body, so jsonParser is applied here only.
app.post("/api/v1/auth/siwe", jsonParser, siweAuthHandler);

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

app.get("/health", (_req, res) => res.json({ status: "ok", gateway: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`[API Gateway] listening on ${port}, forwarding to ${ORCHESTRATOR_URL}`);
});
