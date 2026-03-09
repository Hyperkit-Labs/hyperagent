"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
} from "lucide-react";
import { ROUTES, CLI_VERSION } from "@/constants/routes";

const coreNavItems = [
  { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
  { href: ROUTES.WORKFLOWS, label: "Projects", icon: Folder },
];

const toolsNavItems = [
  { href: ROUTES.AGENTS, label: "Agents", icon: Bot },
  { href: ROUTES.DEPLOYMENTS, label: "Deployments", icon: Rocket },
  { href: ROUTES.CONTRACTS, label: "Contracts", icon: FileCode },
  { href: ROUTES.APPS, label: "Apps", icon: AppWindow },
  { href: ROUTES.NETWORKS, label: "Networks", icon: Globe },
  { href: ROUTES.ANALYTICS, label: "Analytics", icon: BarChart3 },
  { href: ROUTES.HISTORY, label: "History", icon: History },
  { href: ROUTES.PAYMENTS, label: "Payments", icon: DollarSign },
  { href: ROUTES.MONITORING, label: "Logs & Monitoring", icon: FileText },
  { href: ROUTES.SECURITY, label: "Security", icon: Shield },
];

const resourceItems = [
  { href: ROUTES.TEMPLATES, label: "Templates", icon: LayoutTemplate },
  { href: ROUTES.DOMAINS, label: "Infrastructure", icon: Server },
  { href: ROUTES.DOCS, label: "Docs", icon: BookOpen },
];

const NAV_LINK_BASE = "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] min-h-[40px] transition-colors";

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  fullPath,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  fullPath: string;
  onNavigate?: () => void;
}) {
  const hasQuery = href.includes("?");
  const isActive = hasQuery ? fullPath === href : (pathname === href || (href !== ROUTES.DASHBOARD && pathname.startsWith(href)));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${NAV_LINK_BASE} ${
        isActive ? "nav-item-active" : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className={isActive ? "font-medium" : ""}>{label}</span>
    </Link>
  );
}

export interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fullPath = pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            aria-hidden
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-subtle)] shadow-2xl flex flex-col md:hidden"
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="shrink-0 p-4 border-b border-[var(--color-border-subtle)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                  Navigation
                </h2>
                <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
              <Link
                href={ROUTES.HOME}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors text-left w-full min-h-[44px]"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                  <Blocks className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-medium text-white">Back to Project</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
              <div className="space-y-1">
                <span className="px-3 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                  Core
                </span>
                {coreNavItems.map(({ href, label, icon }) => (
                  <NavLink key={href + label} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} onNavigate={onClose} />
                ))}
              </div>
              <div className="space-y-1">
                <span className="px-3 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                  Tools
                </span>
                {toolsNavItems.map(({ href, label, icon }) => (
                  <NavLink key={href + label} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} onNavigate={onClose} />
                ))}
              </div>
              <div className="space-y-1">
                <span className="px-3 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                  Resources
                </span>
                {resourceItems.map(({ href, label, icon }) => (
                  <NavLink key={href} href={href} label={label} icon={icon} pathname={pathname} fullPath={fullPath} onNavigate={onClose} />
                ))}
              </div>
            </nav>
            <div className="shrink-0 px-4 py-3 border-t border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-dim)]">
              {`Hyperkit CLI v${CLI_VERSION}`}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
