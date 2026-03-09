/**
 * HyperAgent Storage Service
 * IPFS pin/unpin via IPFSStorage backend (e.g. Pinata). Max body 5mb; optional rate limit. Port 4005.
 */

import cors from "cors";
import express from "express";
import { createDefaultStorage } from "./backends.js";

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

const storage = createDefaultStorage();

const REQUEST_ID_HEADER = "x-request-id";

function requestIdMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
  const id = (req.headers[REQUEST_ID_HEADER] as string)?.trim() || "";
  (req as express.Request & { requestId?: string }).requestId = id;
  if (id) {
    console.log(`[Storage] requestId=${id} path=${req.path}`);
  }
  next();
}

const app = express();
app.use(requestIdMiddleware);
app.use(cors());
app.use(express.json({ limit: MAX_BODY_BYTES }));

app.post("/ipfs/pin", async (req, res) => {
  if (!rateLimit(req)) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  try {
    const { content, name } = req.body as { content: string; name: string };
    if (!storage) {
      return res.status(503).json({ error: "PINATA_JWT not configured" });
    }
    const result = await storage.pin(content ?? "", name ?? "unnamed");
    res.json({
      success: true,
      cid: result.cid,
      gatewayUrl: result.gatewayUrl,
      size: JSON.stringify({ name, content }).length,
    });
  } catch (e: unknown) {
    console.error("[Storage] Pin error:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Pin failed" });
  }
});

app.post("/ipfs/unpin", async (req, res) => {
  try {
    const { cid } = req.body as { cid: string };
    if (!storage) {
      return res.status(503).json({ error: "PINATA_JWT not configured" });
    }
    await storage.unpin(cid);
    res.json({ success: true, cid });
  } catch (e: unknown) {
    console.error("[Storage] Unpin error:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Unpin failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 4005;
app.listen(port, "0.0.0.0", () => {
  console.log(`[Storage] listening on ${port}`);
});
