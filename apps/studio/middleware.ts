import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROUTES } from "@/constants/routes";

const SESSION_COOKIE_NAME = "hyperagent_has_session";

/** Only /login is accessible without a session. All other paths require connect + sign in. */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === ROUTES.LOGIN) {
    return NextResponse.next();
  }
  const hasSession = request.cookies.get(SESSION_COOKIE_NAME)?.value === "1";
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.LOGIN;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|hyperkit-header-white.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
