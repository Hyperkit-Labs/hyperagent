"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  Settings,
  PanelRightOpen,
  ChevronRight,
  Menu,
  LayoutGrid,
} from "lucide-react";
import { ConnectWalletNav } from "@/components/wallet/ConnectWalletNav";
import { NetworkSelector } from "@/components/layout/NetworkSelector";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { useLayout } from "@/components/providers/LayoutProvider";
import { ROUTES } from "@/constants/routes";
import { ActionSearchBar, ExpandableToolbar } from "@/components/ui";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const PATH_LABELS: Record<string, string> = {
  [ROUTES.DASHBOARD]: "Overview",
  [ROUTES.WORKFLOWS]: "Projects",
  [ROUTES.WORKFLOW_CREATE]: "New Project",
  [ROUTES.AGENTS]: "Agents",
  [ROUTES.DEPLOYMENTS]: "Deployments",
  [ROUTES.CONTRACTS]: "Contracts",
  [ROUTES.TEMPLATES]: "Templates",
  [ROUTES.ANALYTICS]: "Analytics",
  [ROUTES.PAYMENTS]: "Payments",
  [ROUTES.NETWORKS]: "Networks",
  [ROUTES.MONITORING]: "Logs",
  [ROUTES.SECURITY]: "Security",
  [ROUTES.SETTINGS]: "Settings",
  [ROUTES.APPS]: "Apps",
  [ROUTES.APPS_NEW]: "New App",
  [ROUTES.HISTORY]: "History",
  [ROUTES.DOMAINS]: "Infrastructure",
  [ROUTES.DOCS]: "Docs",
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = useMemo(() => {
    if (!pathname || pathname === "/")
      return [{ label: "Chat", href: ROUTES.HOME }];
    const parts = pathname.split("/").filter(Boolean);
    const segments: { label: string; href: string }[] = [];
    for (let i = 0; i < parts.length; i++) {
      const href = "/" + parts.slice(0, i + 1).join("/");
      const label =
        PATH_LABELS[href] ??
        (i === parts.length - 1 ? parts[i] : parts[i].slice(0, 8) + "...");
      segments.push({ label, href });
    }
    return segments.length
      ? segments
      : [{ label: "Overview", href: ROUTES.DASHBOARD }];
  }, [pathname]);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)]">
      {segments.map((s, i) => (
        <span key={s.href} className="flex items-center gap-1.5">
          {i > 0 && (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
          )}
          <Link
            href={s.href}
            className="hover:text-[var(--color-text-primary)] transition-colors truncate max-w-[200px]"
          >
            {s.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

export function AppBar() {
  const {
    contextSidebarOpen,
    toggleContextSidebar,
    openCommandPalette,
    toggleMobileNav,
  } = useLayout();
  const compactTools = useMediaQuery("(max-width: 1023px)");

  return (
    <header className="h-16 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/90 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-40 shrink-0">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={toggleMobileNav}
          className="md:hidden p-2 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link
          href={ROUTES.HOME}
          className="flex items-center gap-2 shrink-0"
          title="Current project"
        >
          <Image
            src="/hyperkit-header-white.svg"
            alt="Hyperkit"
            width={100}
            height={34}
            className="h-7 w-auto object-contain"
          />
        </Link>
        <div className="h-5 w-px bg-[var(--color-border-default)] hidden sm:block" />
        <Breadcrumb />
        <div className="hidden lg:flex flex-1 min-w-0 justify-center px-4">
          <ActionSearchBar
            onClick={openCommandPalette}
            placeholder="Search workspace, open routes…"
            className="max-w-md w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-4 shrink-0 min-w-0">
        <NetworkSelector />
        <div className="h-5 w-px bg-[var(--color-border-default)] hidden sm:block" />

        {compactTools ? (
          <ExpandableToolbar
            label="Search & panels"
            defaultCollapsed
            icon={<LayoutGrid className="h-3.5 w-3.5 opacity-80" />}
            className="min-w-0 max-w-[11rem] sm:max-w-[14rem]"
            triggerClassName="border border-[var(--color-border-subtle)] rounded-md bg-[var(--color-bg-panel)]/60"
          >
            <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-2 shadow-lg">
              <ActionSearchBar
                onClick={openCommandPalette}
                placeholder="Search or jump…"
                className="max-w-none"
              />
              <button
                type="button"
                onClick={toggleContextSidebar}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  contextSidebarOpen
                    ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <PanelRightOpen className="h-4 w-4 shrink-0" />
                Resource inspector
              </button>
              <div className="flex justify-stretch [&_button]:w-full">
                <NotificationsDropdown />
              </div>
            </div>
          </ExpandableToolbar>
        ) : (
          <div className="flex items-center gap-2">
            <ActionSearchBar
              onClick={openCommandPalette}
              className="hidden md:flex lg:hidden max-w-[14rem] xl:max-w-xs"
            />
            <button
              type="button"
              onClick={toggleContextSidebar}
              className={`p-1.5 rounded-md transition-colors ${contextSidebarOpen ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"}`}
              aria-label={
                contextSidebarOpen
                  ? "Close resource inspector"
                  : "Open resource inspector"
              }
              title="Resource Inspector (right panel)"
            >
              <PanelRightOpen className="w-5 h-5" />
            </button>
            <NotificationsDropdown />
          </div>
        )}
        <ConnectWalletNav />
        <Link
          href={ROUTES.SETTINGS}
          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1 shrink-0"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
