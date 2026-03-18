/**
 * Optional OpenTelemetry request span middleware.
 * When OPENTELEMETRY_ENABLED=1, creates an HTTP request span and propagates trace context.
 * No-op when disabled or when @opentelemetry packages are not installed.
 */

import type { Request, Response, NextFunction } from "express";

const OTEL_ENABLED = ["1", "true", "yes"].includes(
  (process.env.OPENTELEMETRY_ENABLED || "").trim().toLowerCase()
);

/**
 * Returns the traceparent header value for the current span context.
 * Use when forwarding requests to downstream services (e.g. proxy).
 * Returns undefined when OTel is disabled or no active span.
 */
export function getTraceparentHeader(): string | undefined {
  if (!OTEL_ENABLED) return undefined;
  try {
    const api = require("@opentelemetry/api");
    const span = api.trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    if (!ctx || !ctx.traceId || !ctx.spanId) return undefined;
    const flags = ctx.traceFlags !== undefined ? ctx.traceFlags.toString(16).padStart(2, "0") : "01";
    return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
  } catch {
    return undefined;
  }
}

/**
 * Creates an HTTP request span when OPENTELEMETRY_ENABLED.
 * Extracts trace context from incoming traceparent; creates child span for this request.
 */
export function otelRequestSpanMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!OTEL_ENABLED) return next();
  try {
    const api = require("@opentelemetry/api");
    const { W3CTraceContextPropagator } = require("@opentelemetry/propagator-w3c-tracecontext");
    const propagator = new W3CTraceContextPropagator();
    const carrier: Record<string, string> = {};
    if (req.headers["traceparent"]) carrier.traceparent = req.headers["traceparent"] as string;
    if (req.headers["tracestate"]) carrier.tracestate = req.headers["tracestate"] as string;
    const ctx = Object.keys(carrier).length
      ? propagator.extract(api.context.active(), carrier)
      : api.context.active();
    const tracer = api.trace.getTracer("hyperagent.backend", "0.1.0");
    const method = req.method || "GET";
    const path = (req.path || req.url || "/").split("?")[0];
    const requestId = (req as { requestId?: string }).requestId;
    tracer.startActiveSpan(
      "http.request",
      { attributes: { "http.method": method, "http.url": path, request_id: requestId || "" } },
      ctx,
      (span: { setAttribute: (k: string, v: number) => void; end: () => void }) => {
        res.on("finish", () => {
          span.setAttribute("http.status_code", res.statusCode);
          span.end();
        });
        api.context.with(api.trace.setSpan(ctx, span), () => next());
      }
    );
  } catch {
    next();
  }
}
