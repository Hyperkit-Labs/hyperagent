/**
 * HyperAgent API Gateway
 * Versioned proxy /api/v1 to orchestrator; legacy /run, /runs.
 * Required: JWT auth (AUTH_JWT_SECRET), Upstash REST rate limit (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). Security is mandatory.
 */
import "./load-env.js";
import cors from "cors";
import express, { NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requestIdMiddleware, type RequestWithId } from "./requestId.js";
import { otelRequestSpanMiddleware, validateRequiredSecrets } from "@hyperagent/backend-middleware";
import { log } from "./logger.js";
import { authMiddleware, type RequestWithUser } from "./auth.js";
import { rateLimitMiddleware, hasRestRateLimitEnv } from "./rateLimit.js";
import { authBootstrapHandler } from "./authBootstrap.js";
import { byokRouter } from "./byok.js";
import { createProxyOptions } from "./proxy.js";
import { healthHandler } from "./health.js";
import { meteringMiddleware } from "./metering.js";
import { x402GatewayMiddleware } from "./x402.js";
import { Env, getGatewayEnv } from "@hyperagent/config";
import { initOtel } from "./otel-sdk.js";
import { initSentry } from "./sentry-init.js";

initSentry();
initOtel();

const gw = getGatewayEnv();

validateRequiredSecrets(
  [Env.AUTH_JWT_SECRET, Env.SUPABASE_URL, Env.SUPABASE_SERVICE_KEY],
  "api-gateway",
);

if (gw.isProduction && !hasRestRateLimitEnv()) {
  log.fatal("Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for rate limiting");
  process.exit(1);
}

if (gw.isProduction && !gw.auth.jwtSecret) {
  log.fatal("Production requires AUTH_JWT_SECRET");
  process.exit(1);
}

const allowedOrigins = gw.corsOrigins;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (gw.nodeEnv === "development") {
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

const jsonParser = express.json({ limit: "2mb" });

app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);

app.get("/health/live", (_req, res) => {
  res.json({ status: "ok", gateway: true });
});

app.get("/health", healthHandler(gw.orchestratorUrl));

app.use(authMiddleware);
app.use((req, res, next) => {
  (rateLimitMiddleware as (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>)(req, res, next).catch(next);
});

app.use((req, res, next) => {
  void meteringMiddleware(req as RequestWithUser, res, next).catch(next);
});

// x402 payment gate — must run after auth (needs X-User-Id from JWT) but
// before the proxy so external agents get 402 challenges, not a proxy 401.
app.use((req, res, next) => {
  x402GatewayMiddleware(req, res, next);
});

// --- Routes ---

app.post("/api/v1/auth/bootstrap", jsonParser, (req, res, next) => {
  void authBootstrapHandler(req, res).catch(next);
});
app.use("/api/v1/byok", jsonParser, byokRouter);

const proxyOpts = () => createProxyOptions(gw.orchestratorUrl, gw.proxyTimeoutMs);

app.use("/api/v1", createProxyMiddleware(proxyOpts()));
app.use("/run", createProxyMiddleware(proxyOpts()));
app.use("/runs", createProxyMiddleware(proxyOpts()));
app.use("/api", createProxyMiddleware(proxyOpts()));
app.use("/docs", createProxyMiddleware(proxyOpts()));
app.use("/openapi.json", createProxyMiddleware(proxyOpts()));

app.use((err: unknown, req: RequestWithId, res: express.Response, _next: NextFunction) => {
  const msg = err instanceof Error ? err.message : String(err);
  log.error(
    {
      err: msg,
      stack: err instanceof Error ? err.stack : undefined,
      requestId: req.requestId,
    },
    "unhandled route error"
  );
  if (res.headersSent) return;
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    requestId: req.requestId,
  });
});

const port = gw.port;
app.listen(port, "0.0.0.0", () => {
  log.info({
    msg: "api-gateway started",
    port,
    orchestrator: gw.orchestratorUrl,
  });
});
