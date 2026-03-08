"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Folder,
  Shield,
  BarChart3,
  Rocket,
  FileCode,
  Plus,
  Search,
  LayoutDashboard,
  Globe,
  FileText,
  Bot,
  AppWindow,
  History,
  DollarSign,
  Settings,
  BookOpen,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";

const ROUTE_ITEMS = [
  { id: "nav-dashboard", label: "Go to Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { id: "nav-workflows", label: "Go to Projects", href: ROUTES.WORKFLOWS, icon: Folder },
  { id: "nav-networks", label: "Go to Networks", href: ROUTES.NETWORKS, icon: Globe },
  { id: "nav-security", label: "Go to Security", href: ROUTES.SECURITY, icon: Shield },
  { id: "nav-monitoring", label: "Go to Logs", href: ROUTES.MONITORING, icon: FileText },
  { id: "nav-analytics", label: "Go to Analytics", href: ROUTES.ANALYTICS, icon: BarChart3 },
  { id: "nav-contracts", label: "Go to Contracts", href: ROUTES.CONTRACTS, icon: FileCode },
  { id: "nav-apps", label: "Go to Apps", href: ROUTES.APPS, icon: AppWindow },
  { id: "nav-agents", label: "Go to Agents", href: ROUTES.AGENTS, icon: Bot },
  { id: "nav-history", label: "Go to History", href: ROUTES.HISTORY, icon: History },
  { id: "nav-payments", label: "Go to Payments", href: ROUTES.PAYMENTS, icon: DollarSign },
  { id: "nav-settings", label: "Go to Settings", href: ROUTES.SETTINGS, icon: Settings },
  { id: "nav-docs", label: "Go to Docs", href: ROUTES.DOCS, icon: BookOpen },
];

const ACTION_ITEMS = [
  { id: "action-new-workflow", label: "New Workflow", href: ROUTES.CHAT, icon: Plus },
  { id: "action-deploy-base", label: "Deploy to Base", href: ROUTES.DEPLOYMENTS, icon: Rocket },
  { id: "action-audit", label: "Start OpenSandbox Audit", href: ROUTES.CHAT, icon: Shield },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  const run = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
        <Command
          className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-2xl overflow-hidden"
        loop
        onKeyDown={(e) => {
          if (e.key === "Escape") onOpenChange(false);
        }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
          <Search className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-1.5 text-[10px] text-[var(--color-text-muted)]">
            Esc
          </kbd>
        </div>
        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No results found.
          </Command.Empty>
          <Command.Group heading="Actions" className="mb-2">
            {ACTION_ITEMS.map((item) => (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => run(item.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-[var(--color-bg-hover)] data-[selected=true]:text-[var(--color-text-primary)] text-[var(--color-text-secondary)]"
              >
                <item.icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group heading="Quick Jump">
            {ROUTE_ITEMS.map((item) => (
              <Command.Item
                key={item.id}
                value={`${item.label} ${item.href}`}
                onSelect={() => run(item.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-[var(--color-bg-hover)] data-[selected=true]:text-[var(--color-text-primary)] text-[var(--color-text-secondary)]"
              >
                <item.icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                {item.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
      </div>
    </div>
  );
}
