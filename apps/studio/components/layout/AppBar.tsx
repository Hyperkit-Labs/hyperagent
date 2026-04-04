"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Settings, PanelRightOpen, ChevronRight, Menu } from "lucide-react";
import { ConnectWalletNav } from "@/components/wallet/ConnectWalletNav";
import { NetworkSelector } from "@/components/layout/NetworkSelector";
import { NotificationsDropdown } from "@/components/layout/NotificationsDropdown";
import { useLayout } from "@/components/providers/LayoutProvider";
import { ROUTES } from "@/constants/routes";

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
      </div>

      <div className="flex items-center justify-end gap-4 shrink-0">
        <NetworkSelector />
        <div className="h-5 w-px bg-[var(--color-border-default)] hidden sm:block" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCommandPalette}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors border border-[var(--color-border-subtle)]"
            aria-label="Open command palette"
            title="Command palette (Cmd+K)"
          >
            <span>Search</span>
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-1.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
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
          <ConnectWalletNav />
          <Link
            href={ROUTES.SETTINGS}
            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
