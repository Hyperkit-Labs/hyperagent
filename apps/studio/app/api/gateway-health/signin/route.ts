import { NextResponse } from "next/server";
import { getGatewayOrigin } from "@/lib/api/core";
import { ApiPaths } from "@hyperagent/api-contracts";

/**
 * Same-origin proxy for GET /health/signin so the login page does not depend on
 * cross-origin fetches to the API gateway (avoids CORS preflight stalls that surface as "Server offline").
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = getGatewayOrigin().replace(/\/$/, "");
  const url = `${origin}${ApiPaths.healthSignin}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type":
          res.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { status: "unreachable", message: "health_proxy_unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(t);
  }
}
