"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications: { id: string; title: string; time?: string }[] = [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors relative p-1"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-[var(--color-semantic-error)] rounded-full border-2 border-[var(--color-bg-elevated)]" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 max-h-[320px] overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-xl z-50 py-2">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--color-text-tertiary)] text-sm">
              No notifications yet.
            </div>
          ) : (
            <ul className="py-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <div className="px-4 py-2 hover:bg-[var(--color-bg-panel)] text-[13px] text-[var(--color-text-primary)]">
                    {n.title}
                    {n.time && <span className="block text-[11px] text-[var(--color-text-dim)] mt-0.5">{n.time}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
