import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "@/config/environment";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 60_000;
const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

function gatewayOrigin(): string {
  const apiBase = getServiceUrl("backend").replace(/\/$/, "");
  return apiBase.replace(/\/api\/v1\/?$/, "");
}

function stripHopByHop(headers: Headers): Headers {
  const nextHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "connection"
    ) {
      continue;
    }
    nextHeaders.set(key, value);
  }
  return nextHeaders;
}

function sessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const item = part.trim();
    if (!item) continue;
    const eq = item.indexOf("=");
    if (eq <= 0) continue;
    const key = item.slice(0, eq).trim();
    if (key !== SESSION_TOKEN_COOKIE_NAME) continue;
    const value = item.slice(eq + 1).trim();
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

async function proxy(request: NextRequest, path: string[]) {
  const origin = gatewayOrigin();
  const joined = path.join("/");
  const search = request.nextUrl.search || "";
  const url = `${origin}/${joined}${search}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const method = request.method.toUpperCase();
    const headers = stripHopByHop(request.headers);
    const cookieHeader = request.headers.get("cookie");
    const cookieToken = sessionTokenFromCookieHeader(cookieHeader);
    const hasAuthorization = headers.has("authorization");
    if (!hasAuthorization && cookieToken) {
      headers.set("authorization", `Bearer ${cookieToken}`);
    }
    headers.delete("cookie");
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
  } catch {
    return NextResponse.json(
      {
        error: "Bad Gateway",
        message: "gateway_proxy_unreachable",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
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
