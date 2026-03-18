/**
 * Route paths. Single source of truth for app navigation.
 */

export const ROUTES = {
  HOME: '/',
  /** Only route accessible without session. Connect wallet + sign in here. */
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  /** Same as HOME; /chat redirects to /. */
  CHAT: '/',
  WORKFLOWS: '/workflows',
  WORKFLOW_CREATE: '/workflows/create',
  WORKFLOW_ID: (id: string) => `/workflows/${id}`,
  WORKFLOW_RUN: (wfId: string, runId: string) => `/workflows/${wfId}/runs/${runId}`,
  AGENTS: '/agents',
  DEPLOYMENTS: '/deployments',
  CONTRACTS: '/contracts',
  TEMPLATES: '/templates',
  MARKETPLACE: '/marketplace',
  ANALYTICS: '/analytics',
  PAYMENTS: '/payments',
  NETWORKS: '/networks',
  MONITORING: '/monitoring',
  SECURITY: '/security',
  SETTINGS: '/settings',
  APPS: '/apps',
  APPS_NEW: '/apps/new',
  APPS_ID: (id: string) => `/apps/${id}`,
  HISTORY: '/history',
  DOMAINS: '/domains',
  DOCS: '/docs',
} as const;

/** Hyperkit CLI version shown in sidebar. Align with root package.json. */
export const CLI_VERSION = "0.1.0";

/** Routes that render full-page (no AppBar/Sidebar). */
export const FULL_PAGE_ROUTES: string[] = [ROUTES.HOME, ROUTES.LOGIN];

/** Only route accessible without session. All other routes require connect + sign in. */
export const PUBLIC_ROUTE = ROUTES.LOGIN;

/**
 * Paths that require session cookie (middleware). If no session, redirect to LOGIN.
 * LayoutSwitcher: if no wallet on a protected route, redirect to LOGIN.
 */
export const PROTECTED_PATH_PREFIXES: string[] = [
  ROUTES.HOME,
  ROUTES.DASHBOARD,
  ROUTES.WORKFLOWS,
  ROUTES.WORKFLOW_CREATE,
  ROUTES.AGENTS,
  ROUTES.DEPLOYMENTS,
  ROUTES.CONTRACTS,
  ROUTES.TEMPLATES,
  ROUTES.MARKETPLACE,
  ROUTES.ANALYTICS,
  ROUTES.PAYMENTS,
  ROUTES.NETWORKS,
  ROUTES.MONITORING,
  ROUTES.SECURITY,
  ROUTES.SETTINGS,
  ROUTES.APPS,
  ROUTES.HISTORY,
  ROUTES.DOMAINS,
  ROUTES.DOCS,
  "/apps/",
];
