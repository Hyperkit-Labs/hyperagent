"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Blocks, X, ChevronDown } from "lucide-react";
import { ROUTES, CLI_VERSION } from "@/constants/routes";
import {
  getStudioNavItems,
  isNavRouteActive,
  STUDIO_NAV_GROUPS,
  type StudioNavGroupKey,
} from "@/constants/navigation";

const NAV_LINK_BASE =
  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] min-h-[40px] transition-colors";

function SectionHeader({
  label,
  sectionKey,
  isOpen,
  onToggle,
}: {
  label: string;
  sectionKey: "core" | "tools" | "resources";
  isOpen: boolean;
  onToggle: (key: "core" | "tools" | "resources") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(sectionKey)}
      className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
      aria-expanded={isOpen}
      aria-controls={`mobile-nav-${sectionKey}`}
    >
      <span>{label}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  );
}

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
  const isActive = hasQuery
    ? fullPath === href
    : isNavRouteActive(pathname, href);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${NAV_LINK_BASE} ${
        isActive
          ? "nav-item-active"
          : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-panel)] hover:text-[var(--color-text-primary)]"
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
  const fullPath =
    pathname + (searchParams.toString() ? "?" + searchParams.toString() : "");
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState({
    core: true,
    tools: true,
    resources: true,
  });

  useEffect(() => {
    if (open) {
      previousFocusRef.current =
        typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null;
      document.body.style.overflow = "hidden";
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus?.();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const root = drawerRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const toggleSection = (key: "core" | "tools" | "resources") => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const navGroups: { key: StudioNavGroupKey; label: string }[] = [
    { key: "core", label: STUDIO_NAV_GROUPS.core },
    { key: "tools", label: STUDIO_NAV_GROUPS.tools },
    { key: "resources", label: STUDIO_NAV_GROUPS.resources },
  ];

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
            id="mobile-navigation-drawer"
            ref={drawerRef}
            initial={{ x: "-104%" }}
            animate={{ x: 0 }}
            exit={{ x: "-104%" }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 32,
              mass: 0.72,
            }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-[var(--color-bg-elevated)] border-r border-[var(--color-border-subtle)] shadow-2xl flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="shrink-0 p-4 border-b border-[var(--color-border-subtle)] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
                  Navigation
                </h2>
                <button
                  ref={closeButtonRef}
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
                <span className="text-[13px] font-medium text-white">
                  Back to Project
                </span>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
              {navGroups.map((group) => {
                const items = getStudioNavItems(group.key);
                return (
                  <div key={group.key} className="space-y-1">
                    <SectionHeader
                      label={group.label}
                      sectionKey={group.key}
                      isOpen={sectionsOpen[group.key]}
                      onToggle={toggleSection}
                    />
                    {sectionsOpen[group.key] && (
                      <div id={`mobile-nav-${group.key}`} className="space-y-1">
                        {items.map(({ href, label, icon }) => (
                          <NavLink
                            key={href}
                            href={href}
                            label={label}
                            icon={icon}
                            pathname={pathname}
                            fullPath={fullPath}
                            onNavigate={onClose}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
