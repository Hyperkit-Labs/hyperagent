"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Shield, Rocket, Plus, Search } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { getCommandPaletteRouteItems } from "@/constants/navigation";

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const ROUTE_ITEMS: PaletteItem[] = getCommandPaletteRouteItems().map(
  (item) => ({
    id: `nav-${item.href.replace(/\//g, "-") || "home"}`,
    label: `Go to ${item.label}`,
    href: item.href,
    icon: item.icon,
    description: item.description,
  }),
);

const ACTION_ITEMS: PaletteItem[] = [
  {
    id: "action-new-workflow",
    label: "New Workflow",
    href: ROUTES.CHAT,
    icon: Plus,
    description: "Start a new build with HyperAgent",
  },
  {
    id: "action-deploy-base",
    label: "Deploy to Base",
    href: ROUTES.DEPLOYMENTS,
    icon: Rocket,
    description: "Deploy contracts to Base network",
  },
  {
    id: "action-audit",
    label: "Start OpenSandbox Audit",
    href: ROUTES.CHAT,
    icon: Shield,
    description: "Run security audit on a contract",
  },
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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
    if (open) {
      previousFocusRef.current =
        typeof document !== "undefined"
          ? (document.activeElement as HTMLElement | null)
          : null;
      const timer = window.setTimeout(() => {
        const input = dialogRef.current?.querySelector("input");
        if (input instanceof HTMLElement) {
          input.focus();
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    previousFocusRef.current?.focus?.();
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
    [onOpenChange, router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
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
            if (e.key === "Escape") {
              onOpenChange(false);
              return;
            }

            if (e.key !== "Tab") return;
            const root = dialogRef.current;
            if (!root) return;
            const focusable = Array.from(
              root.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
              ),
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement as HTMLElement | null;

            if (e.shiftKey && active === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && active === last) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="flex border-b border-white/5">
            <div className="flex-1 px-3 py-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search templates, docs, workflows…"
                aria-label="Search command palette"
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
                  <p className="font-medium text-slate-300 mb-1">
                    {selectedItem.label}
                  </p>
                  <p>{selectedItem.description ?? "No description"}</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-600">
                  Select an item to see details.
                </p>
              )}
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
