/**
 * HyperAgent API Gateway
 * Versioned proxy /api/v1 to orchestrator; legacy /run, /runs.
 * Required: JWT auth (AUTH_JWT_SECRET), Upstash REST rate limit (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). Security is mandatory.
 */
import { config } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import cors from "cors";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requestIdMiddleware } from "./requestId.js";
import { otelRequestSpanMiddleware, validateRequiredSecrets } from "@hyperagent/backend-middleware";
import { log } from "./logger.js";
import { authMiddleware } from "./auth.js";
import { rateLimitMiddleware, hasRestRateLimitEnv } from "./rateLimit.js";
import { authBootstrapHandler } from "./authBootstrap.js";
import { byokRouter } from "./byok.js";
import { createProxyOptions } from "./proxy.js";
import { healthHandler } from "./health.js";

validateRequiredSecrets(
  ["AUTH_JWT_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"],
  "api-gateway",
);

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || "http://localhost:8000";
const NODE_ENV = process.env.NODE_ENV || "development";
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 25_000;

if (NODE_ENV === "production" && !hasRestRateLimitEnv()) {
  log.fatal("Production requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for rate limiting");
  process.exit(1);
}

const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET;
if (NODE_ENV === "production" && !AUTH_JWT_SECRET) {
  log.fatal("Production requires AUTH_JWT_SECRET");
  process.exit(1);
}

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

app.use(authMiddleware);
app.use((req, res, next) => {
  (rateLimitMiddleware as (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>)(req, res, next).catch(next);
});

// --- Routes ---

app.post("/api/v1/auth/bootstrap", jsonParser, authBootstrapHandler);
app.use("/api/v1/byok", jsonParser, byokRouter);

const proxyOpts = () => createProxyOptions(ORCHESTRATOR_URL, PROXY_TIMEOUT_MS);

app.use("/api/v1", createProxyMiddleware(proxyOpts()));
app.use("/run", createProxyMiddleware(proxyOpts()));
app.use("/runs", createProxyMiddleware(proxyOpts()));
app.use("/api", createProxyMiddleware(proxyOpts()));
app.use("/docs", createProxyMiddleware(proxyOpts()));
app.use("/openapi.json", createProxyMiddleware(proxyOpts()));

app.get("/health", healthHandler(ORCHESTRATOR_URL));

const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => {
  log.info({
    msg: "api-gateway started",
    port,
    orchestrator: ORCHESTRATOR_URL,
  });
});
