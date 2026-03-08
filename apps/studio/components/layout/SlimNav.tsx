"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  PanelLeftClose,
  PanelLeft,
  GripVertical,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";

const SIDEBAR_MIN = 64;
const SIDEBAR_MAX = 280;
const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 224;
const STORAGE_KEY = "hyperkit-sidebar";

function loadSidebarState() {
  if (typeof window === "undefined") return { expanded: true, width: SIDEBAR_EXPANDED };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { expanded: true, width: SIDEBAR_EXPANDED };
    const parsed = JSON.parse(raw) as { expanded?: boolean; width?: number };
    return {
      expanded: parsed.expanded ?? true,
      width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, parsed.width ?? SIDEBAR_EXPANDED)),
    };
  } catch {
    return { expanded: true, width: SIDEBAR_EXPANDED };
  }
}

function saveSidebarState(expanded: boolean, width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ expanded, width }));
  } catch {
    /* ignore */
  }
}

const coreNavItems = [
  { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
  { href: ROUTES.WORKFLOWS, label: "Projects", icon: Folder },
] as const;

const toolsNavItems = [
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
] as const;

const allNavItems = [...coreNavItems, ...toolsNavItems, ...resourceItems];

function NavItem({
  href,
  label,
  icon: Icon,
  pathname,
  expanded,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  expanded: boolean;
}) {
  const isActive =
    pathname === href || (href !== ROUTES.DASHBOARD && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`group relative flex h-10 items-center gap-3 rounded-xl transition-colors ${
        expanded ? "w-full px-3" : "w-10 shrink-0 justify-center"
      } ${
        isActive
          ? "bg-violet-500/20 text-violet-400"
          : "text-slate-400 hover:text-slate-50 hover:bg-white/5"
      }`}
      title={!expanded ? label : undefined}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && (
        <span className="text-[13px] font-medium truncate">{label}</span>
      )}
      {!expanded && (
        <span className="pointer-events-none absolute left-11 z-50 rounded-md bg-slate-900/90 px-2 py-1 text-[11px] text-slate-100 opacity-0 shadow-lg backdrop-blur group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {label}
        </span>
      )}
    </Link>
  );
}

export function SlimNav() {
  const pathname = usePathname();
  const [sidebarState, setSidebarState] = useState(() => ({
    expanded: true,
    width: SIDEBAR_EXPANDED,
  }));
  const { expanded, width } = sidebarState;

  useEffect(() => {
    const saved = loadSidebarState();
    setSidebarState(saved);
  }, []);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const currentWidth = expanded ? width : SIDEBAR_COLLAPSED;

  useEffect(() => {
    saveSidebarState(sidebarState.expanded, sidebarState.width);
  }, [sidebarState.expanded, sidebarState.width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = sidebarRef.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX - left));
      setSidebarState((s) => ({
        ...s,
        expanded: newWidth > SIDEBAR_COLLAPSED + 8,
        width: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const toggleExpand = useCallback(() => {
    setSidebarState((s) => ({
      ...s,
      expanded: !s.expanded,
      width: s.expanded ? s.width : SIDEBAR_EXPANDED,
    }));
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className="flex flex-col border-r border-white/5 bg-slate-950/60 backdrop-blur-md shrink-0 hidden md:flex relative transition-[width] duration-200 ease-out overflow-hidden"
      style={{ width: currentWidth }}
    >
      <Link
        href={ROUTES.HOME}
        className="h-14 flex items-center justify-center border-b border-white/5 shrink-0"
        title="Project"
      >
        <div className="h-8 w-8 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
          <Blocks className="w-4 h-4 text-violet-400" />
        </div>
      </Link>

      <nav
        className={`flex-1 flex flex-col gap-2 py-4 min-w-0 overflow-x-hidden overflow-y-auto ${
          expanded ? "items-stretch px-2" : "items-center"
        }`}
      >
        {allNavItems.map((item) => (
          <NavItem
            key={item.href + item.label}
            href={item.href}
            label={item.label}
            icon={item.icon}
            pathname={pathname ?? ""}
            expanded={expanded}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/5 flex flex-col">
        <button
          type="button"
          onClick={toggleExpand}
          className="flex items-center justify-center h-10 w-full text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeft className="w-5 h-5" />
          )}
        </button>
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={handleMouseDown}
          className={`flex items-center justify-center h-8 cursor-col-resize text-slate-500 hover:text-slate-400 hover:bg-white/5 transition-colors ${
            isResizing ? "bg-white/5" : ""
          }`}
          title="Drag to resize sidebar"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </aside>
  );
}
