import { NextResponse } from "next/server";
import { getApiBase, joinApiUrlForFetch } from "@/lib/api/core";
import { ApiPaths } from "@hyperagent/api-contracts";

/**
 * Same-origin proxy for public platform track record (used on login). Avoids
 * cross-origin CORS to the gateway from the browser.
 */
const UPSTREAM_TIMEOUT_MS = 10_000;

export const dynamic = "force-dynamic";

export async function GET() {
  const url = joinApiUrlForFetch(getApiBase(), ApiPaths.platformTrackRecord);
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
        Content:
          res.headers.get("content-type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { source: "env_defaults" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(t);
  }
}
