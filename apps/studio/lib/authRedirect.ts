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
 */
export function redirectToLoginWithNext(): void {
  if (typeof window === "undefined") return;
  window.location.href = getLoginRedirectHref();
}
