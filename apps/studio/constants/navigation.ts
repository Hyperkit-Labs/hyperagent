import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BarChart3,
  BookOpen,
  Bot,
  DollarSign,
  FileCode,
  FileText,
  Folder,
  Globe,
  History,
  LayoutDashboard,
  LayoutTemplate,
  Rocket,
  Server,
  Settings,
  Shield,
  Store,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";

export type StudioNavGroupKey = "core" | "tools" | "resources";

export interface StudioNavItem {
  href: string;
  label: string;
  description: string;
  group: StudioNavGroupKey;
  icon: LucideIcon;
}

export interface BreadcrumbItem {
  href: string;
  label: string;
  current?: boolean;
}

interface RouteMatcher {
  match: (pathname: string) => boolean;
  label: string;
}

export const STUDIO_NAV_GROUPS: Record<StudioNavGroupKey, string> = {
  core: "Core",
  tools: "Tools",
  resources: "Resources",
};

export const STUDIO_NAV_ITEMS: readonly StudioNavItem[] = [
  {
    href: ROUTES.DASHBOARD,
    label: "Overview",
    description: "Overview of projects, runs, and workspace health",
    group: "core",
    icon: LayoutDashboard,
  },
  {
    href: ROUTES.WORKFLOWS,
    label: "Projects",
    description: "Manage workflows, runs, and delivery status",
    group: "core",
    icon: Folder,
  },
  {
    href: ROUTES.AGENTS,
    label: "Agents",
    description: "AI agents, teams, and capability registry",
    group: "tools",
    icon: Bot,
  },
  {
    href: ROUTES.DEPLOYMENTS,
    label: "Deployments",
    description: "Deployment history, targets, and actions",
    group: "tools",
    icon: Rocket,
  },
  {
    href: ROUTES.CONTRACTS,
    label: "Contracts",
    description: "Generated contracts, addresses, and artifacts",
    group: "tools",
    icon: FileCode,
  },
  {
    href: ROUTES.APPS,
    label: "Apps",
    description: "Runtime apps generated from workflow outputs",
    group: "tools",
    icon: AppWindow,
  },
  {
    href: ROUTES.NETWORKS,
    label: "Networks",
    description: "Supported chains, defaults, and runtime targets",
    group: "tools",
    icon: Globe,
  },
  {
    href: ROUTES.ANALYTICS,
    label: "Analytics",
    description: "Usage, spend, and pipeline metrics",
    group: "tools",
    icon: BarChart3,
  },
  {
    href: ROUTES.HISTORY,
    label: "History",
    description: "Past workflows, runs, and execution logs",
    group: "tools",
    icon: History,
  },
  {
    href: ROUTES.PAYMENTS,
    label: "Payments",
    description: "x402 billing, credits, and spending controls",
    group: "tools",
    icon: DollarSign,
  },
  {
    href: ROUTES.MONITORING,
    label: "Logs & Monitoring",
    description: "Logs, incidents, and platform observability",
    group: "tools",
    icon: FileText,
  },
  {
    href: ROUTES.SECURITY,
    label: "Security",
    description: "Audit results, findings, and security posture",
    group: "tools",
    icon: Shield,
  },
  {
    href: ROUTES.TEMPLATES,
    label: "Templates",
    description: "Reusable workflow and contract starting points",
    group: "resources",
    icon: LayoutTemplate,
  },
  {
    href: ROUTES.MARKETPLACE,
    label: "Marketplace",
    description: "Browse registry templates and published starter packs",
    group: "resources",
    icon: Store,
  },
  {
    href: ROUTES.DOMAINS,
    label: "Infrastructure",
    description: "Domains, environments, and infrastructure metadata",
    group: "resources",
    icon: Server,
  },
  {
    href: ROUTES.DOCS,
    label: "Docs",
    description: "Guides, API reference, and operator docs",
    group: "resources",
    icon: BookOpen,
  },
] as const;

const STATIC_ROUTE_LABELS = new Map<string, string>([
  [ROUTES.HOME, "Chat"],
  [ROUTES.CHAT, "Chat"],
  [ROUTES.LOGIN, "Login"],
  [ROUTES.WORKFLOW_CREATE, "New Project"],
  [ROUTES.APPS_NEW, "New App"],
  [ROUTES.SETTINGS, "Settings"],
  ...STUDIO_NAV_ITEMS.map((item) => [item.href, item.label] as const),
]);

const DYNAMIC_ROUTE_MATCHERS: readonly RouteMatcher[] = [
  {
    match: (pathname) => /^\/workflows\/[^/]+\/runs\/[^/]+$/.test(pathname),
    label: "Run",
  },
  {
    match: (pathname) => /^\/workflows\/[^/]+$/.test(pathname),
    label: "Workflow",
  },
  {
    match: (pathname) => /^\/apps\/[^/]+$/.test(pathname),
    label: "App",
  },
];

function joinPathSegments(parts: string[]): string {
  return parts.length === 0 ? ROUTES.HOME : `/${parts.join("/")}`;
}

export function getStudioNavItems(
  group?: StudioNavGroupKey,
): readonly StudioNavItem[] {
  if (!group) return STUDIO_NAV_ITEMS;
  return STUDIO_NAV_ITEMS.filter((item) => item.group === group);
}

export function getRouteLabel(pathname: string | null | undefined): string {
  if (!pathname) return "Overview";
  const normalized = pathname === ROUTES.CHAT ? ROUTES.HOME : pathname;
  const staticLabel = STATIC_ROUTE_LABELS.get(normalized);
  if (staticLabel) return staticLabel;
  const dynamicLabel = DYNAMIC_ROUTE_MATCHERS.find((item) =>
    item.match(normalized),
  );
  if (dynamicLabel) return dynamicLabel.label;
  const lastSegment = normalized.split("/").filter(Boolean).pop();
  if (!lastSegment) return "Overview";
  return lastSegment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isNavRouteActive(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (!pathname) return false;
  return (
    pathname === href ||
    (href !== ROUTES.DASHBOARD && pathname.startsWith(href))
  );
}

export function getBreadcrumbItems(
  pathname: string | null | undefined,
): BreadcrumbItem[] {
  if (!pathname || pathname === ROUTES.HOME || pathname === ROUTES.CHAT) {
    return [{ href: ROUTES.HOME, label: "Chat", current: true }];
  }

  if (/^\/workflows\/[^/]+\/runs\/[^/]+$/.test(pathname)) {
    const [, , workflowId, , runId] = pathname.split("/");
    return [
      { href: ROUTES.WORKFLOWS, label: "Projects" },
      { href: ROUTES.WORKFLOW_ID(workflowId), label: "Workflow" },
      {
        href: ROUTES.WORKFLOW_RUN(workflowId, runId),
        label: "Run",
        current: true,
      },
    ];
  }

  if (/^\/workflows\/[^/]+$/.test(pathname)) {
    const workflowId = pathname.split("/")[2] ?? "";
    return [
      { href: ROUTES.WORKFLOWS, label: "Projects" },
      {
        href: ROUTES.WORKFLOW_ID(workflowId),
        label: "Workflow",
        current: true,
      },
    ];
  }

  if (/^\/apps\/[^/]+$/.test(pathname)) {
    const appId = pathname.split("/")[2] ?? "";
    return [
      { href: ROUTES.APPS, label: "Apps" },
      { href: ROUTES.APPS_ID(appId), label: "App", current: true },
    ];
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.map((_, index) => {
    const href = joinPathSegments(parts.slice(0, index + 1));
    return {
      href,
      label: getRouteLabel(href),
      current: index === parts.length - 1,
    };
  });
}

export function getCommandPaletteRouteItems(): readonly StudioNavItem[] {
  return [
    ...STUDIO_NAV_ITEMS,
    {
      href: ROUTES.SETTINGS,
      label: "Settings",
      description: "Workspace configuration, BYOK, and integrations",
      group: "resources",
      icon: Settings,
    },
  ];
}
