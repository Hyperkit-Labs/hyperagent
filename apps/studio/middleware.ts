import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTES } from "@/constants/routes";

const SESSION_COOKIE_NAME = "hyperagent_has_session";
const SESSION_EXPIRES_COOKIE_NAME = "hyperagent_session_expires";
/** Carries the raw JWT so middleware can inspect exp without localStorage. Set by session-store. */
const SESSION_TOKEN_COOKIE_NAME = "hyperagent_session_token";

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
  if (pathname === ROUTES.LOGIN) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (
    process.env.NODE_ENV !== "production" &&
    request.cookies.get(E2E_BYPASS_COOKIE)?.value === "1"
  ) {
    const res = NextResponse.next();
    res.headers.set("x-e2e-bypass", "1");
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
    return NextResponse.next();
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresStr = request.cookies.get(SESSION_EXPIRES_COOKIE_NAME)?.value;
  if (expiresStr) {
    const expiresAt = parseInt(expiresStr, 10);
    if (!Number.isNaN(expiresAt) && now >= expiresAt) {
      return _redirectToLogin(request);
    }
  }

  return NextResponse.next();
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
