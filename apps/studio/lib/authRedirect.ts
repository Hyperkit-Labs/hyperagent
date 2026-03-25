import { ROUTES } from "@/constants/routes";

/**
 * Target path for SPA redirect to login (client router).
 * When already on /login (including /login?next=...), returns /login only so we never nest
 * ?next=%2Flogin%3Fnext%3D... (infinite redirect / document reload loop).
 */
export function getLoginRedirectHref(): string {
  if (typeof window === "undefined") return ROUTES.LOGIN;
  const { pathname, search } = window.location;
  if (pathname === ROUTES.LOGIN) return ROUTES.LOGIN;
  return `${ROUTES.LOGIN}?next=${encodeURIComponent(pathname + search)}`;
}

/**
 * Full navigation to login (window.location). Use after clearing session on auth failure.
 * Skips redirect when already on /login to avoid refresh loops.
 */
export function redirectToLoginWithNext(): void {
  if (typeof window === "undefined") return;
  const { pathname } = window.location;
  if (pathname === ROUTES.LOGIN) return;
  window.location.href = getLoginRedirectHref();
}
