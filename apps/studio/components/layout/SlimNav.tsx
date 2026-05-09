"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, PanelLeftClose, PanelLeft, GripVertical } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  getStudioNavItems,
  isNavRouteActive,
  STUDIO_NAV_GROUPS,
} from "@/constants/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_MIN = 64;
const SIDEBAR_MAX = 280;
const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 224;
const STORAGE_KEY = "hyperkit-sidebar";

function loadSidebarState() {
  if (typeof window === "undefined")
    return { expanded: true, width: SIDEBAR_EXPANDED };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { expanded: true, width: SIDEBAR_EXPANDED };
    const parsed = JSON.parse(raw) as { expanded?: boolean; width?: number };
    return {
      expanded: parsed.expanded ?? true,
      width: Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, parsed.width ?? SIDEBAR_EXPANDED),
      ),
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
  const isActive = isNavRouteActive(pathname, href);

  const link = (
    <Link
      href={href}
      className={`group relative flex h-10 items-center gap-3 rounded-xl transition-colors ${
        expanded ? "w-full px-3" : "w-10 shrink-0 justify-center"
      } ${
        isActive
          ? "bg-violet-500/20 text-violet-400"
          : "text-slate-400 hover:text-slate-50 hover:bg-white/5"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && (
        <span className="text-[13px] font-medium truncate">{label}</span>
      )}
    </Link>
  );

  if (!expanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="border-white/10">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function SlimNav() {
  const pathname = usePathname();
  const navGroups = [
    { key: "core" as const, label: STUDIO_NAV_GROUPS.core },
    { key: "tools" as const, label: STUDIO_NAV_GROUPS.tools },
    { key: "resources" as const, label: STUDIO_NAV_GROUPS.resources },
  ];
  const [sidebarState, setSidebarState] = useState(loadSidebarState);
  const { expanded, width } = sidebarState;
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
      const newWidth = Math.min(
        SIDEBAR_MAX,
        Math.max(SIDEBAR_MIN, e.clientX - left),
      );
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

  const resizeSidebar = useCallback((nextWidth: number) => {
    const clampedWidth = Math.min(
      SIDEBAR_MAX,
      Math.max(SIDEBAR_MIN, nextWidth),
    );
    setSidebarState((state) => ({
      ...state,
      expanded: clampedWidth > SIDEBAR_COLLAPSED,
      width: clampedWidth,
    }));
  }, []);

  const handleResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          resizeSidebar(currentWidth - 16);
          break;
        case "ArrowRight":
          event.preventDefault();
          resizeSidebar(currentWidth + 16);
          break;
        case "Home":
          event.preventDefault();
          resizeSidebar(SIDEBAR_MIN);
          break;
        case "End":
          event.preventDefault();
          resizeSidebar(SIDEBAR_MAX);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          toggleExpand();
          break;
        default:
          break;
      }
    },
    [currentWidth, resizeSidebar, toggleExpand],
  );

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
        id="studio-sidebar-nav"
        className={`flex-1 flex flex-col gap-2 py-4 min-w-0 overflow-x-hidden overflow-y-auto ${
          expanded ? "items-stretch px-2" : "items-center"
        }`}
      >
        {navGroups.map((group) => {
          const items = getStudioNavItems(group.key);
          return (
            <div
              key={group.key}
              className={`flex flex-col gap-1 ${expanded ? "px-1" : ""}`}
            >
              {expanded ? (
                <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {group.label}
                </p>
              ) : null}
              {items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  pathname={pathname ?? ""}
                  expanded={expanded}
                />
              ))}
            </div>
          );
        })}
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
          role="slider"
          aria-orientation="vertical"
          aria-controls="studio-sidebar-nav"
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={currentWidth}
          aria-valuetext={`${currentWidth}px sidebar width`}
          aria-label="Sidebar width"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onKeyDown={handleResizeKeyDown}
          className={`flex items-center justify-center h-8 cursor-col-resize text-slate-500 hover:text-slate-400 hover:bg-white/5 transition-colors ${
            isResizing ? "bg-white/5" : ""
          }`}
          title="Resize sidebar"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>
    </aside>
  );
}
