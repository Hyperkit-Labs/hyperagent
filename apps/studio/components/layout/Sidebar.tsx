"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Folder,
  LayoutTemplate,
  Bot,
  Rocket,
  FileText,
  Blocks,
  FileCode,
  Globe,
  Shield,
  DollarSign,
  BarChart3,
  AppWindow,
  History,
  Server,
  BookOpen,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";

const mainNavItems = [
  { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
  { href: ROUTES.WORKFLOWS, label: "Projects", icon: Folder },
  { href: ROUTES.AGENTS, label: "Agents", icon: Bot },
  { href: ROUTES.DEPLOYMENTS, label: "Deployments", icon: Rocket },
  { href: ROUTES.CONTRACTS, label: "Contracts", icon: FileCode },
  { href: ROUTES.APPS, label: "Apps", icon: AppWindow },
  { href: ROUTES.NETWORKS, label: "Networks", icon: Globe },
  { href: ROUTES.ANALYTICS, label: "Analytics", icon: BarChart3 },
  { href: ROUTES.HISTORY, label: "History", icon: History },
  { href: ROUTES.PAYMENTS, label: "Payments", icon: DollarSign },
  { href: ROUTES.MONITORING, label: "Logs", icon: FileText },
  { href: ROUTES.SECURITY, label: "Security", icon: Shield },
] as const;

const resourceItems = [
  { href: ROUTES.TEMPLATES, label: "Templates", icon: LayoutTemplate },
  { href: ROUTES.DOMAINS, label: "Infrastructure", icon: Server },
  { href: ROUTES.DOCS, label: "Docs", icon: BookOpen },
];

const NAV_LINK_BASE = "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] group transition-colors min-h-[40px]";

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  fullPath,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  fullPath: string;
}) {
  const hasQuery = href.includes("?");
  const isActive = hasQuery ? fullPath === href : (pathname === href || (href !== ROUTES.DASHBOARD && pathname.startsWith(href)));
  return (
    <Link
      href={href}
      className={`${NAV_LINK_BASE} ${
        isActive ? "nav-item-active" : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 group-hover:text-purple-400 transition-colors" />
      <span className={isActive ? "font-medium" : ""}>{label}</span>
    </Link>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {mainNavItems.map(({ href, label, icon }) => (
          <NavLink key={href + label} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} />
        ))}
      </div>

      <div className="pt-3">
        <div className="px-3 py-2">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Resources</span>
        </div>
        <div className="pl-2 space-y-0.5">
          {resourceItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} />
          ))}
        </div>
      </div>
    </>
  );
}

function SidebarNavFallback() {
  const pathname = usePathname();
  const fullPath = pathname;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {mainNavItems.map(({ href, label, icon }) => (
          <NavLink key={href + label} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} />
        ))}
      </div>
      <div className="pt-3">
        <div className="px-3 py-2">
          <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Resources</span>
        </div>
        <div className="pl-2 space-y-0.5">
          {resourceItems.map(({ href, label, icon }) => (
            <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} />
          ))}
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 min-w-[256px] bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-subtle)] flex flex-col shrink-0 transition-all duration-300 hidden md:flex">
      <div className="shrink-0 p-4 pb-4 border-b border-[var(--color-border-subtle)] min-h-[104px] flex flex-col justify-center">
        <h2 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest mb-3">
          What would you like to build?
        </h2>
        <Link
          href={ROUTES.CHAT}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors group text-left w-full min-h-[44px]"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Blocks className="w-4 h-4" />
          </div>
          <span className="text-[13px] font-medium text-white group-hover:text-purple-200">
            Back to Project
          </span>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 py-4 px-3 overflow-y-auto hide-scrollbar">
        <Suspense fallback={<SidebarNavFallback />}>
          <SidebarNav />
        </Suspense>
      </nav>

      <div className="shrink-0 px-4 py-3 border-t border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-dim)]">
        Hyperkit CLI v2.4.0
      </div>
    </aside>
  );
}
