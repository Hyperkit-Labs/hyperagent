import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildStudioConnectSrcDirective } from "@hyperagent/config";
import { ROUTES } from "@/constants/routes";

const SESSION_COOKIE_NAME = "hyperagent_has_session";
const SESSION_EXPIRES_COOKIE_NAME = "hyperagent_session_expires";
const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const NONCE_HEADER = "x-nonce";
const CSP_NONCE_HEADER = "x-csp-nonce";

/**
 * Single CSP string for response and mirrored request header.
 * Next.js reads `Content-Security-Policy` on the *incoming request* during SSR to
 * extract `nonce-*` for framework and bundle script tags. The response header * alone is not enough; mirror the policy on forwarded request headers.
 * @see https://nextjs.org/docs/app/guides/content-security-policy
 */
function buildContentSecurityPolicy(nonce: string): string {
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${buildStudioConnectSrcDirective(process.env as Record<string, string | undefined>)}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "frame-src 'self' https://embedded-wallet.thirdweb.com https://*.thirdweb.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function requestHeadersWithNonce(request: NextRequest, nonce: string): Headers {
  const h = new Headers(request.headers);
  h.set(NONCE_HEADER, nonce);
  h.set(CSP_NONCE_HEADER, nonce);
  h.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return h;
}

function nextWithCsp(request: NextRequest, nonce: string): NextResponse {
  const res = NextResponse.next({
    request: {
      headers: requestHeadersWithNonce(request, nonce),
    },
  });
  applySecurityHeaders(res, nonce);
  res.headers.set(NONCE_HEADER, nonce);
  res.headers.set(CSP_NONCE_HEADER, nonce);
  // Prevent cached HTML reusing stale nonce values across users/requests.
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function applySecurityHeaders(res: NextResponse, nonce: string): void {
  res.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = ROUTES.LOGIN;
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function _isValidJwt(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    const exp = payload.exp;
    if (typeof exp !== "number") return false;
    return Math.floor(Date.now() / 1000) < exp;
  } catch {
    return false;
  }
}

const E2E_BYPASS_COOKIE = "PLAYWRIGHT_E2E";

/**
 * Next.js 16+ proxy (replaces deprecated middleware file name). Edge runtime; uses @hyperagent/config for CSP connect-src.
 */
export function proxy(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const nonce = generateNonce();

  if (pathname === ROUTES.LOGIN) {
    return nextWithCsp(request, nonce);
  }

  if (pathname.startsWith("/api/")) {
    const PUBLIC_API_PREFIXES = ["/api/auth/"];
    const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
    if (isPublicApi) {
      return nextWithCsp(request, nonce);
    }

    const token =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.cookies.get(SESSION_TOKEN_COOKIE_NAME)?.value;

    if (!token || !_isValidJwt(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return nextWithCsp(request, nonce);
  }

  if (
    process.env.NODE_ENV !== "production" &&
    request.cookies.get(E2E_BYPASS_COOKIE)?.value === "1"
  ) {
    const res = nextWithCsp(request, nonce);
    res.headers.set("x-e2e-bypass", "1");
    return res;
  }

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === "1";
  if (!hasSession) {
    return redirectToLogin(request);
  }

  const rawToken = request.cookies.get(SESSION_TOKEN_COOKIE_NAME)?.value;
  if (rawToken) {
    if (!_isValidJwt(rawToken)) {
      return redirectToLogin(request);
    }
    return nextWithCsp(request, nonce);
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresStr = request.cookies.get(SESSION_EXPIRES_COOKIE_NAME)?.value;
  if (expiresStr) {
    const expiresAt = parseInt(expiresStr, 10);
    if (!Number.isNaN(expiresAt) && now >= expiresAt) {
      return redirectToLogin(request);
    }
  }

  return nextWithCsp(request, nonce);
}

/**
 * Must stay static (Next.js extracts config at build time). Keep in sync with
 * `lib/studio-proxy-config.ts` (`STUDIO_PROXY_MATCHER_PATTERN`, `isExcludedFromStudioEdge`).
 */
export const config = {
  matcher: [
    "/((?!_next/|_vercel/|\\.well-known/|favicon\\.ico|robots\\.txt|manifest\\.json|sitemap\\.xml|site\\.webmanifest|manifest\\.webmanifest|hyperkit-header-white\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)",
  ],
};
