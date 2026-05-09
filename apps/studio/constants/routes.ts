/**
 * Route paths. Single source of truth for app navigation.
 */

export const ROUTES = {
  HOME: "/",
  /** Only route accessible without session. Connect wallet + sign in here. */
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  /** Same as HOME; /chat redirects to /. */
  CHAT: "/",
  WORKFLOWS: "/workflows",
  WORKFLOW_CREATE: "/workflows/create",
  WORKFLOW_ID: (id: string) => `/workflows/${id}`,
  WORKFLOW_RUN: (wfId: string, runId: string) =>
    `/workflows/${wfId}/runs/${runId}`,
  AGENTS: "/agents",
  DEPLOYMENTS: "/deployments",
  CONTRACTS: "/contracts",
  TEMPLATES: "/templates",
  MARKETPLACE: "/marketplace",
  ANALYTICS: "/analytics",
  PAYMENTS: "/payments",
  NETWORKS: "/networks",
  MONITORING: "/monitoring",
  SECURITY: "/security",
  SETTINGS: "/settings",
  APPS: "/apps",
  APPS_NEW: "/apps/new",
  APPS_ID: (id: string) => `/apps/${id}`,
  HISTORY: "/history",
  DOMAINS: "/domains",
  DOCS: "/docs",
} as const;

export const LEGACY_ROUTE_REDIRECTS = {
  "/chat": ROUTES.HOME,
  "/logs": ROUTES.MONITORING,
} as const;

export const PUBLIC_STUDIO_ROUTES = [ROUTES.LOGIN] as const;
export const PUBLIC_STUDIO_API_PREFIXES = [
  "/api/auth/",
  "/api/gateway-health/",
] as const;

export const SHELLLESS_STUDIO_ROUTES = [ROUTES.HOME, ROUTES.LOGIN] as const;

const STATIC_STUDIO_PROTECTED_ROUTES = Array.from(
  new Set(
    Object.values(ROUTES).filter(
      (route): route is string =>
        typeof route === "string" && route !== ROUTES.LOGIN,
    ),
  ),
);

const DYNAMIC_STUDIO_PROTECTED_ROUTE_PREFIXES = [
  "/workflows/",
  "/apps/",
] as const;

const LEGACY_STUDIO_PROTECTED_ROUTES = Object.keys(
  LEGACY_ROUTE_REDIRECTS,
) as readonly string[];

export type StudioShellMode = "public" | "shellless" | "shared";

export function isPublicStudioRoute(
  pathname: string | null | undefined,
): boolean {
  return Boolean(
    pathname &&
    PUBLIC_STUDIO_ROUTES.includes(
      pathname as (typeof PUBLIC_STUDIO_ROUTES)[number],
    ),
  );
}

export function isShelllessStudioRoute(
  pathname: string | null | undefined,
): boolean {
  return Boolean(
    pathname &&
    SHELLLESS_STUDIO_ROUTES.includes(
      pathname as (typeof SHELLLESS_STUDIO_ROUTES)[number],
    ),
  );
}

export function isProtectedStudioRoute(
  pathname: string | null | undefined,
): boolean {
  if (!pathname || isPublicStudioRoute(pathname)) return false;
  if (STATIC_STUDIO_PROTECTED_ROUTES.includes(pathname)) return true;
  if (LEGACY_STUDIO_PROTECTED_ROUTES.includes(pathname)) return true;
  return DYNAMIC_STUDIO_PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function getStudioShellMode(
  pathname: string | null | undefined,
): StudioShellMode {
  if (isPublicStudioRoute(pathname)) return "public";
  if (isShelllessStudioRoute(pathname)) return "shellless";
  return "shared";
}

export function isPublicStudioApiPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return PUBLIC_STUDIO_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/** Hyperkit CLI version shown in sidebar. Align with root package.json. */
export const CLI_VERSION = "0.1.0";

/** Routes that render full-page (no AppBar/Sidebar). */
export const FULL_PAGE_ROUTES: string[] = [...SHELLLESS_STUDIO_ROUTES];

/** Only route accessible without session. All other routes require connect + sign in. */
export const PUBLIC_ROUTE = ROUTES.LOGIN;

/**
 * Paths that require session cookie (middleware). If no session, redirect to LOGIN.
 * LayoutSwitcher: if no wallet on a protected route, redirect to LOGIN.
 */
export const PROTECTED_PATH_PREFIXES: string[] = [
  ...STATIC_STUDIO_PROTECTED_ROUTES,
  ...DYNAMIC_STUDIO_PROTECTED_ROUTE_PREFIXES,
  ...LEGACY_STUDIO_PROTECTED_ROUTES,
];
