/**
 * Next.js `proxy.ts` matcher + test helpers. Single source for which paths skip session/CSP edge logic.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

const EXACT_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/manifest.json",
  "/sitemap.xml",
  "/site.webmanifest",
  "/manifest.webmanifest",
  "/hyperkit-header-white.svg",
]);

const STATIC_EXT = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$/i;

/**
 * Paths that must not run session/auth or nonce CSP (framework assets, analytics, crawlers).
 * Keep in sync with `STUDIO_PROXY_MATCHER_PATTERN` and `proxy.ts` `config.matcher`.
 */
export function isExcludedFromStudioEdge(pathname: string): boolean {
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/_vercel/") ||
    pathname.startsWith("/.well-known/")
  ) {
    return true;
  }
  if (EXACT_PATHS.has(pathname)) return true;
  if (STATIC_EXT.test(pathname)) return true;
  return false;
}

/**
 * Exact string that must appear in `proxy.ts` `config.matcher[0]` (Next.js requires a static literal there).
 * Contract-tested in `lib/__tests__/proxy-matcher-contract.test.ts`.
 */
export const STUDIO_PROXY_MATCHER_PATTERN =
  "/((?!_next/|_vercel/|\\.well-known/|favicon\\.ico|robots\\.txt|manifest\\.json|sitemap\\.xml|site\\.webmanifest|manifest\\.webmanifest|hyperkit-header-white\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)" as const;
