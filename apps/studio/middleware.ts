import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTES } from "@/constants/routes";

const SESSION_COOKIE_NAME = "hyperagent_has_session";
const SESSION_EXPIRES_COOKIE_NAME = "hyperagent_session_expires";
const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same sources as next.config.ts `connect-src` so combined CSP policies allow gateway + BYOK LLMs + wallets. */
function connectSrcDirective(): string {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:4000");
  let apiOrigin = "";
  try {
    if (apiUrl && apiUrl.startsWith("http")) apiOrigin = new URL(apiUrl).origin;
    else if (apiUrl) apiOrigin = apiUrl;
  } catch {
    apiOrigin = "";
  }
  return [
    "'self'",
    apiOrigin,
    "http://localhost:4000",
    "http://127.0.0.1:4000",
    "https://api.openai.com",
    "https://api.anthropic.com",
    "https://generativelanguage.googleapis.com",
    "https://api.together.xyz",
    "wss:",
    "https://*.thirdweb.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://base-sepolia-testnet.skalenodes.com",
    "https://skale-base.skalenodes.com",
    "https://sepolia.base.org",
    "https://*.bundler.thirdweb.com",
  ]
    .filter(Boolean)
    .join(" ");
}

function applySecurityHeaders(res: NextResponse, nonce: string): void {
  // next dev + webpack HMR / react-refresh use eval(); production keeps nonce + strict-dynamic only.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrcDirective()}`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
}

function _redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = ROUTES.LOGIN;
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Decode and validate JWT structure and expiry (edge runtime has no crypto for HS256).
 * Gateway validates signature on API calls; middleware validates structure and exp.
 * Returns true if token is structurally valid and not expired.
 */
function _isValidJwt(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp = payload.exp;
    if (typeof exp !== "number") return false;
    return Math.floor(Date.now() / 1000) < exp;
  } catch {
    return false;
  }
}

/** E2E bypass: when PLAYWRIGHT_E2E=1 cookie is set in dev, skip auth for happy-path tests. */
const E2E_BYPASS_COOKIE = "PLAYWRIGHT_E2E";

/** All routes except /login require a valid, non-expired session. */
export function middleware(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  const nonce = generateNonce();

  if (pathname === ROUTES.LOGIN) {
    const res = NextResponse.next();
    applySecurityHeaders(res, nonce);
    res.headers.set("x-nonce", nonce);
    return res;
  }

  if (pathname.startsWith("/api/")) {
    const PUBLIC_API_PREFIXES = ["/api/auth/"];
    const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
    if (isPublicApi) {
      return NextResponse.next();
    }

    const token =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.cookies.get(SESSION_TOKEN_COOKIE_NAME)?.value;

    if (!token || !_isValidJwt(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = NextResponse.next();
    res.headers.set("x-nonce", nonce);
    return res;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    request.cookies.get(E2E_BYPASS_COOKIE)?.value === "1"
  ) {
    const res = NextResponse.next();
    applySecurityHeaders(res, nonce);
    res.headers.set("x-e2e-bypass", "1");
    res.headers.set("x-nonce", nonce);
    return res;
  }

  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === "1";
  if (!hasSession) {
    return _redirectToLogin(request);
  }

  const rawToken = request.cookies.get(SESSION_TOKEN_COOKIE_NAME)?.value;
  if (rawToken) {
    if (!_isValidJwt(rawToken)) {
      return _redirectToLogin(request);
    }
    const res = NextResponse.next();
    applySecurityHeaders(res, nonce);
    res.headers.set("x-nonce", nonce);
    return res;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresStr = request.cookies.get(SESSION_EXPIRES_COOKIE_NAME)?.value;
  if (expiresStr) {
    const expiresAt = parseInt(expiresStr, 10);
    if (!Number.isNaN(expiresAt) && now >= expiresAt) {
      return _redirectToLogin(request);
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res, nonce);
  res.headers.set("x-nonce", nonce);
  return res;
}

/**
 * Matcher: runs for all paths except static assets.
 * / is included (root path matches: negative lookahead fails for empty remainder).
 * Excluded: _next/static, _next/image, favicon.ico, hyperkit-header-white.svg, image extensions.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|hyperkit-header-white.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
