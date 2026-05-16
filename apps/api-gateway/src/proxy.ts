import type { ClientRequest } from "http";
import type express from "express";
import { getTraceparentHeader, signUserId } from "@hyperagent/backend-middleware";
import { getGatewayEnv } from "@hyperagent/config";
import type { RequestWithId } from "./requestId.js";
import type { RequestWithUser } from "./auth.js";
import { log } from "./logger.js";
import { responseInterceptor, createProxyMiddleware } from "http-proxy-middleware";

type GatewayErrorEnvelope = {
  error: string;
  code: string;
  message: string;
  requestId?: string;
  retryable: boolean;
  status: number;
};

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

function parseUpstreamErrorText(rawBody: string): {
  message?: string;
  code?: string;
} {
  if (!rawBody.trim()) return {};
  try {
    const parsed = JSON.parse(rawBody) as {
      message?: unknown;
      error?: unknown;
      code?: unknown;
      detail?: unknown;
    };
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : typeof parsed.detail === "string"
            ? parsed.detail
            : Array.isArray(parsed.detail) &&
                typeof parsed.detail[0]?.msg === "string"
              ? parsed.detail[0].msg
              : undefined;
    return {
      message,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
    };
  } catch {
    return { message: rawBody.trim().slice(0, 240) };
  }
}

function defaultErrorTextForStatus(status: number): {
  error: string;
  code: string;
  message: string;
  retryable: boolean;
} {
  switch (status) {
    case 400:
      return {
        error: "Bad Request",
        code: "request.invalid",
        message: "Invalid request",
        retryable: false,
      };
    case 401:
      return {
        error: "Unauthorized",
        code: "auth.unauthorized",
        message: "Authentication required",
        retryable: false,
      };
    case 402:
      return {
        error: "Payment Required",
        code: "billing.payment_required",
        message: "Payment required",
        retryable: false,
      };
    case 403:
      return {
        error: "Forbidden",
        code: "auth.forbidden",
        message: "Access denied",
        retryable: false,
      };
    case 404:
      return {
        error: "Not Found",
        code: "route.not_found",
        message: "Resource not found",
        retryable: false,
      };
    case 408:
    case 504:
      return {
        error: "Gateway Timeout",
        code: "upstream.timeout",
        message: "Backend timed out. Try again.",
        retryable: true,
      };
    case 409:
      return {
        error: "Conflict",
        code: "request.conflict",
        message: "Request conflict",
        retryable: false,
      };
    case 422:
      return {
        error: "Unprocessable Entity",
        code: "request.validation_failed",
        message: "Request validation failed",
        retryable: false,
      };
    case 429:
      return {
        error: "Too Many Requests",
        code: "request.rate_limited",
        message: "Too many requests. Try again later.",
        retryable: true,
      };
    default:
      return {
        error: status >= 500 ? "Service Unavailable" : "Bad Gateway",
        code: status >= 500 ? "upstream.unavailable" : "gateway.proxy_error",
        message:
          status >= 500
            ? "Backend unavailable. Try again shortly."
            : "Request could not be completed",
        retryable: status >= 500,
      };
  }
}

export function normalizeProxyErrorResponse(
  status: number,
  requestId?: string,
  rawBody: string = "",
): GatewayErrorEnvelope {
  const defaults = defaultErrorTextForStatus(status);
  const parsed = parseUpstreamErrorText(rawBody);
  const safeMessage =
    status >= 500
      ? defaults.message
      : parsed.message || defaults.message;
  return {
    error: defaults.error,
    code: parsed.code || defaults.code,
    message: safeMessage,
    requestId,
    retryable: defaults.retryable,
    status,
  };
}

export function isTimeoutLikeProxyError(err: unknown): boolean {
  const code =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : undefined;
  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err ?? "").toLowerCase();
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNABORTED" ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
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
        const timeoutError = new Error(`Upstream timed out after ${timeoutMs}ms`);
        (timeoutError as Error & { code?: string }).code = "ETIMEDOUT";
        proxyReq.destroy(timeoutError);
      });
      // Avoid forwarding Datadog propagation headers: gateway sets W3C traceparent; mixed extract on Python ddtrace can log "Failed to parse LLMObs parent ID" for bad _dd.p values.
      for (const h of [
        "x-datadog-trace-id",
        "x-datadog-parent-id",
        "x-datadog-sampling-priority",
        "x-datadog-tags",
        "x-datadog-origin",
        "tracebaggage",
      ]) {
        proxyReq.removeHeader(h);
      }
      if (r.requestId) proxyReq.setHeader("x-request-id", r.requestId);
      const traceparent = getTraceparentHeader() || (r.headers.traceparent as string);
      if (traceparent) proxyReq.setHeader("traceparent", traceparent);
      if (r.headers.authorization) proxyReq.setHeader("authorization", r.headers.authorization);
      if (r.headers["x-agent-session"]) proxyReq.setHeader("x-agent-session", r.headers["x-agent-session"] as string);
      proxyReq.setHeader("x-gateway-proxy", "1");
      const internalToken = getGatewayEnv().internalServiceToken;
      if (internalToken) {
        proxyReq.setHeader("x-internal-token", internalToken);
      }
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
      const status = isTimeoutLikeProxyError(err) ? 504 : 502;
      log.error(
        {
          path: req.path,
          requestId: id,
          status,
          category: status === 504 ? "upstream_timeout" : "proxy_transport_error",
          err: err.message,
        },
        "proxy error",
      );
      if (!res.headersSent) {
        res
          .status(status)
          .json(normalizeProxyErrorResponse(status, id ?? undefined));
      }
    },
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const status = proxyRes.statusCode ?? 0;
      const expressReq = req as express.Request & RequestWithId;
      const id = expressReq.requestId;
      const path = "path" in expressReq ? expressReq.path : (expressReq as { url?: string }).url ?? "";
      if (status >= 400) {
        const rawBody = responseBuffer.toString("utf8");
        const category =
          status >= 500
            ? "upstream_server_error"
            : status === 401 || status === 403
              ? "upstream_auth_error"
              : status === 422
                ? "upstream_validation_error"
                : "upstream_client_error";
        const logMethod = status >= 500 ? log.error : log.warn;
        logMethod({ path, status, requestId: id, category }, "upstream error");
        const body = JSON.stringify(
          normalizeProxyErrorResponse(status, id ?? undefined, rawBody),
        );
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
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
