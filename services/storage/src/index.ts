/**
 * HyperAgent Storage Service
 * IPFS pin/unpin via IPFSStorage backend (e.g. Pinata). Max body 5mb; optional rate limit. Port 4005.
 */

import cors from "cors";
import express from "express";
import { requestIdMiddleware, otelRequestSpanMiddleware, requireInternalToken, safeHandler, validateRequiredSecrets, createLogger } from "@hyperagent/backend-middleware";

const log = createLogger("storage");
import { createDefaultStorage } from "./backends.js";

validateRequiredSecrets(["INTERNAL_SERVICE_TOKEN"], "storage");

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX_PER_IP = Number(process.env.RATE_LIMIT_MAX_PER_IP) || 30;
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: express.Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function rateLimit(req: express.Request): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = ipCounts.get(ip);
  if (!entry) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    ipCounts.set(ip, entry);
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_PER_IP;
}

// Periodic cleanup of expired rate-limit entries to prevent unbounded Map growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipCounts) {
    if (now >= entry.resetAt) ipCounts.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

const storage = createDefaultStorage();

const INTERNAL_TOKEN = (process.env.INTERNAL_SERVICE_TOKEN || "").trim();

const app = express();
app.use(requestIdMiddleware);
app.use(otelRequestSpanMiddleware);
app.use(requireInternalToken(INTERNAL_TOKEN));
app.use(cors());
app.use(express.json({ limit: MAX_BODY_BYTES }));

app.post("/ipfs/pin", safeHandler("storage-pin", async (req, res) => {
  if (!rateLimit(req)) {
    res.status(429).json({ error: "Rate limit exceeded" });
    return;
  }
  const { content, name } = req.body as { content: string; name: string };
  if (!storage) {
    res.status(503).json({ error: "PINATA_JWT not configured" });
    return;
  }
  const result = await storage.pin(content ?? "", name ?? "unnamed");
  res.json({
    success: true,
    cid: result.cid,
    gatewayUrl: result.gatewayUrl,
    size: JSON.stringify({ name, content }).length,
  });
}));

app.post("/ipfs/unpin", safeHandler("storage-unpin", async (req, res) => {
  const { cid } = req.body as { cid: string };
  if (!storage) {
    res.status(503).json({ error: "PINATA_JWT not configured" });
    return;
  }
  await storage.unpin(cid);
  res.json({ success: true, cid });
}));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    pinata_configured: Boolean(process.env.PINATA_JWT),
  });
});

const port = Number(process.env.PORT) || 4005;
app.listen(port, "0.0.0.0", () => {
  log.info({ port }, "storage service started");
});
