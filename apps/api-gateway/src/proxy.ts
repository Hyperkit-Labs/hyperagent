import type { ClientRequest } from "http";
import type express from "express";
import { getTraceparentHeader, signUserId } from "@hyperagent/backend-middleware";
import { getGatewayEnv } from "@hyperagent/config";
import type { RequestWithId } from "./requestId.js";
import type { RequestWithUser } from "./auth.js";
import { log } from "./logger.js";
import { responseInterceptor, createProxyMiddleware } from "http-proxy-middleware";

/**
 * Express strips the mount path before the proxy runs, so the upstream only sees
 * the suffix (e.g. `/config` for `GET /api/v1/config`). Orchestrator routers use
 * full paths like `/api/v1/config`. Rewrite to `upstreamPathPrefix + tail + query`.
 */
export function rewriteMountToUpstreamPath(
  pathWithQuery: string,
  upstreamPathPrefix: string,
): string {
  const qIndex = pathWithQuery.indexOf("?");
  const pathname = qIndex >= 0 ? pathWithQuery.slice(0, qIndex) : pathWithQuery;
  const query = qIndex >= 0 ? pathWithQuery.slice(qIndex) : "";
  const tail =
    pathname === "/" || pathname === ""
      ? ""
      : pathname.startsWith("/")
        ? pathname
        : `/${pathname}`;
  const base = upstreamPathPrefix.replace(/\/$/, "");
  return `${base}${tail}${query}`;
}

/**
 * Proxy mounted at `mountPath` (handled in `index.ts` via `app.use(mountPath, …)`).
 * Restores the full path the orchestrator expects after Express strips the mount.
 */
export function createOrchestratorStripMountProxy(
  orchestratorUrl: string,
  timeoutMs: number,
  upstreamPathPrefix: string,
) {
  const baseOpts = createProxyOptions(orchestratorUrl, timeoutMs);
  return createProxyMiddleware({
    ...baseOpts,
    pathRewrite: (path: string) =>
      rewriteMountToUpstreamPath(path, upstreamPathPrefix),
  });
}

export function createProxyOptions(
  orchestratorUrl: string,
  timeoutMs: number,
): Record<string, unknown> {
  return {
    target: orchestratorUrl,
    changeOrigin: true,
    selfHandleResponse: true,
    logLevel: "silent",
    onProxyReq(proxyReq: ClientRequest, req: express.Request) {
      const r = req as express.Request & RequestWithId & RequestWithUser;
      proxyReq.setTimeout(timeoutMs, () => {
        proxyReq.destroy();
      });
      if (r.requestId) proxyReq.setHeader("x-request-id", r.requestId);
      const traceparent = getTraceparentHeader() || (r.headers.traceparent as string);
      if (traceparent) proxyReq.setHeader("traceparent", traceparent);
      if (r.headers.authorization) proxyReq.setHeader("authorization", r.headers.authorization);
      if (r.headers["x-agent-session"]) proxyReq.setHeader("x-agent-session", r.headers["x-agent-session"] as string);
      proxyReq.removeHeader("x-user-id");
      proxyReq.removeHeader("X-User-Id");
      proxyReq.removeHeader("x-user-id-sig");
      if (r.userId) {
        proxyReq.setHeader("x-user-id", r.userId);
        const secret = getGatewayEnv().identityHmacSecret;
        if (secret) {
          proxyReq.setHeader("x-user-id-sig", signUserId(r.userId, secret));
        }
      }
    },
    onError(err: Error, req: express.Request, res: express.Response) {
      const id = (req as RequestWithId).requestId;
      log.error({ path: req.path, requestId: id, err: err.message }, "proxy error");
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
        log.error({ path, status, requestId: id }, "upstream 5xx");
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

/**
 * Proxy mounted at a legacy path (e.g. `/config`) and forwards to the versioned
 * orchestrator route under `upstreamApiV1Prefix` (e.g. `/api/v1/config`).
 * Preserves query string. Express passes `req.url` relative to the mount.
 */
export function createOrchestratorLegacyMountProxy(
  orchestratorUrl: string,
  timeoutMs: number,
  upstreamApiV1Prefix: string,
) {
  const baseOpts = createProxyOptions(orchestratorUrl, timeoutMs);
  return createProxyMiddleware({
    ...baseOpts,
    pathRewrite: (path: string) =>
      rewriteMountToUpstreamPath(path, upstreamApiV1Prefix),
  });
}
