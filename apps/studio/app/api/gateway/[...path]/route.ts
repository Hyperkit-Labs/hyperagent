import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "@/config/environment";
import {
  buildUpstreamHeaders,
  sanitizeGatewayPathSegments,
} from "./route-helpers";

export const dynamic = "force-dynamic";

/** Must exceed gateway→orchestrator proxy timeout (~120s) so Studio does not abort first. */
const UPSTREAM_TIMEOUT_MS = readUpstreamTimeoutMs();

function readUpstreamTimeoutMs(): number {
  const raw = process.env.STUDIO_GATEWAY_PROXY_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 15_000 && n <= 180_000) return n;
  }
  return 125_000;
}

function gatewayOrigin(): string {
  const apiBase = getServiceUrl("backend").replace(/\/$/, "");
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

async function proxy(request: NextRequest, path: string[]) {
  const origin = gatewayOrigin();
  let joined = "";
  try {
    joined = sanitizeGatewayPathSegments(path).join("/");
  } catch {
    return NextResponse.json(
      {
        error: "Bad Request",
        code: "gateway.invalid_path",
        message: "Invalid gateway path",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const search = request.nextUrl.search || "";
  const url = `${origin}/${joined}${search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const method = request.method.toUpperCase();
    const headers = buildUpstreamHeaders(request);
    const incomingContentType = request.headers.get("content-type");
    if (incomingContentType && method !== "GET" && method !== "HEAD") {
      headers.set("content-type", incomingContentType);
    }
    const body =
      method === "GET" || method === "HEAD"
        ? undefined
        : await request.arrayBuffer();

    const upstream = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-store");

    const requestId =
      upstream.headers.get("x-request-id") ||
      upstream.headers.get("X-Request-Id");
    if (requestId) responseHeaders.set("x-request-id", requestId);

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout ? "Gateway Timeout" : "Bad Gateway",
        code: isTimeout
          ? "gateway.upstream_timeout"
          : "gateway.upstream_unreachable",
        message: isTimeout
          ? "Upstream request timed out"
          : "Upstream request failed",
      },
      {
        status: isTimeout ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
