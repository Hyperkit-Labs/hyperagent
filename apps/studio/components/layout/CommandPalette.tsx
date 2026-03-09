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
  LayoutTemplate,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const ROUTE_ITEMS: PaletteItem[] = [
  { id: "nav-dashboard", label: "Go to Dashboard", href: ROUTES.DASHBOARD, icon: LayoutDashboard, description: "Overview of projects and activity" },
  { id: "nav-workflows", label: "Go to Projects", href: ROUTES.WORKFLOWS, icon: Folder, description: "Manage workflows and runs" },
  { id: "nav-networks", label: "Go to Networks", href: ROUTES.NETWORKS, icon: Globe, description: "Configure blockchain networks" },
  { id: "nav-security", label: "Go to Security", href: ROUTES.SECURITY, icon: Shield, description: "Security audits and findings" },
  { id: "nav-monitoring", label: "Go to Logs", href: ROUTES.MONITORING, icon: FileText, description: "Pipeline logs and history" },
  { id: "nav-analytics", label: "Go to Analytics", href: ROUTES.ANALYTICS, icon: BarChart3, description: "Usage and performance metrics" },
  { id: "nav-contracts", label: "Go to Contracts", href: ROUTES.CONTRACTS, icon: FileCode, description: "Deployed contract addresses" },
  { id: "nav-apps", label: "Go to Apps", href: ROUTES.APPS, icon: AppWindow, description: "Manage deployed applications" },
  { id: "nav-agents", label: "Go to Agents", href: ROUTES.AGENTS, icon: Bot, description: "AI agents and capabilities" },
  { id: "nav-history", label: "Go to History", href: ROUTES.HISTORY, icon: History, description: "Past workflow runs" },
  { id: "nav-payments", label: "Go to Payments", href: ROUTES.PAYMENTS, icon: DollarSign, description: "x402 payments and spending" },
  { id: "nav-settings", label: "Go to Settings", href: ROUTES.SETTINGS, icon: Settings, description: "Workspace and API keys" },
  { id: "nav-docs", label: "Go to Docs", href: ROUTES.DOCS, icon: BookOpen, description: "API reference and guides" },
  { id: "nav-templates", label: "Go to Templates", href: ROUTES.TEMPLATES, icon: LayoutTemplate, description: "Pre-built contract templates" },
];

const ACTION_ITEMS: PaletteItem[] = [
  { id: "action-new-workflow", label: "New Workflow", href: ROUTES.CHAT, icon: Plus, description: "Start a new build with HyperAgent" },
  { id: "action-deploy-base", label: "Deploy to Base", href: ROUTES.DEPLOYMENTS, icon: Rocket, description: "Deploy contracts to Base network" },
  { id: "action-audit", label: "Start OpenSandbox Audit", href: ROUTES.CHAT, icon: Shield, description: "Run security audit on a contract" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_ITEMS: PaletteItem[] = [...ACTION_ITEMS, ...ROUTE_ITEMS];

function findItemByValue(value: string): PaletteItem | null {
  if (!value) return null;
  return ALL_ITEMS.find((i) => i.label === value) ?? null;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedItem, setSelectedItem] = useState<PaletteItem | null>(null);

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

  useEffect(() => {
    if (!open) {
      // Reset state when palette closes; deferred to avoid cascading renders
      const t = setTimeout(() => {
        setSearch("");
        setSelectedItem(null);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl overflow-hidden"
      >
        <Command
          className="w-full"
          loop
          value={selectedValue}
          onValueChange={(v) => {
            setSelectedValue(v);
            setSelectedItem(findItemByValue(v));
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          <div className="flex border-b border-white/5">
            <div className="flex-1 px-3 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search templates, docs, workflows…"
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-white/10 bg-slate-900/60 px-1.5 text-[10px] text-slate-500">
                Esc
              </kbd>
            </div>
          </div>
          <div className="flex h-72">
            <div className="flex-1 overflow-auto p-2 min-w-0">
              <Command.List className="max-h-full overflow-y-auto">
                <Command.Empty className="py-6 text-center text-sm text-slate-500">
                  No results found.
                </Command.Empty>
                <Command.Group heading="Actions" className="mb-2">
                  {ACTION_ITEMS.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => run(item.href)}
                      onPointerEnter={() => setSelectedItem(item)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-slate-100 text-slate-300"
                    >
                      <item.icon className="w-4 h-4 text-slate-500 shrink-0" />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Quick Jump">
                  {ROUTE_ITEMS.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => run(item.href)}
                      onPointerEnter={() => setSelectedItem(item)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer data-[selected=true]:bg-white/5 data-[selected=true]:text-slate-100 text-slate-300"
                    >
                      <item.icon className="w-4 h-4 text-slate-500 shrink-0" />
                      {item.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </div>
            <div className="w-56 border-l border-white/5 bg-slate-900/60 px-3 py-2 shrink-0">
              <p className="text-[11px] text-slate-500 mb-1">Preview</p>
              {selectedItem ? (
                <div className="text-[11px] text-slate-400">
                  <p className="font-medium text-slate-300 mb-1">{selectedItem.label}</p>
                  <p>{selectedItem.description ?? "No description"}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600">Select an item to see details.</p>
              )}
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
