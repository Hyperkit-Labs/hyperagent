import { NextRequest, NextResponse } from "next/server";
import { getServiceUrl } from "@/config/environment";

export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 60_000;

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
