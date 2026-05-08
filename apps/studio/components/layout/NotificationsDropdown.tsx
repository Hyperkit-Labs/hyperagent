"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { getWorkflows } from "@/lib/api";
import { ROUTES } from "@/constants/routes";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; title: string; time?: string }[]
  >([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const menuId = "studio-notifications-menu";

  useEffect(() => {
    if (!open) return;
    getWorkflows({ limit: 5 })
      .then((res) => {
        const wfs = res.workflows ?? [];
        setNotifications(
          wfs.slice(0, 5).map((w) => ({
            id: w.workflow_id,
            title:
              w.status === "completed"
                ? `Workflow completed`
                : w.status === "failed"
                  ? `Workflow failed`
                  : `Workflow ${w.status}`,
            time: w.updated_at ?? w.created_at,
          })),
        );
      })
      .catch((err) => {
        setNotifications([]);
        if (
          process.env.NODE_ENV === "development" &&
          typeof console !== "undefined"
        ) {
          console.warn("[Notifications] fetch failed:", err);
        }
      });
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open || notifications.length === 0) return;
    const timer = window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, notifications]);

  function focusItem(nextIndex: number) {
    const items = itemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    const safeIndex =
      ((nextIndex % items.length) + items.length) % items.length;
    items[safeIndex]?.focus();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (
            event.key === "ArrowDown" ||
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors relative p-1"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-[var(--color-semantic-error)] rounded-full border-2 border-[var(--color-bg-elevated)]" />
        )}
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full mt-1.5 w-72 max-h-[320px] overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xl z-50 py-2"
          role="menu"
          aria-label="Notifications menu"
          onKeyDown={(event) => {
            const currentIndex = itemRefs.current.findIndex(
              (item) => item === document.activeElement,
            );
            switch (event.key) {
              case "ArrowDown":
                event.preventDefault();
                focusItem(currentIndex < 0 ? 0 : currentIndex + 1);
                break;
              case "ArrowUp":
                event.preventDefault();
                focusItem(
                  currentIndex < 0
                    ? notifications.length - 1
                    : currentIndex - 1,
                );
                break;
              case "Home":
                event.preventDefault();
                focusItem(0);
                break;
              case "End":
                event.preventDefault();
                focusItem(notifications.length - 1);
                break;
              case "Escape":
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
                break;
              default:
                break;
            }
          }}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--color-text-tertiary)] text-sm">
              <p className="font-medium text-[var(--color-text-secondary)] mb-1">
                No recent activity
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Workflow status updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((n, index) => (
                <li key={n.id} role="none">
                  <Link
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    href={`${ROUTES.HOME}?workflow=${encodeURIComponent(n.id)}`}
                    role="menuitem"
                    tabIndex={-1}
                    className="w-full px-4 py-2 hover:bg-[var(--color-bg-panel)] text-[13px] text-[var(--color-text-primary)] text-left"
                    onClick={() => setOpen(false)}
                  >
                    {n.title}
                    {n.time && (
                      <span className="block text-[11px] text-[var(--color-text-dim)] mt-0.5">
                        {n.time}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
