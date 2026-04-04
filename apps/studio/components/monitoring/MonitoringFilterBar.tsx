"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const LEVEL_OPTIONS = ["all", "error", "warn", "info"] as const;
export const TIME_RANGE_OPTIONS = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7d" },
] as const;

export interface MonitoringFilterBarProps {
  services: string[];
  level: string;
  timeRange: string;
  service: string;
  onLevelChange: (level: string) => void;
  onTimeRangeChange: (timeRange: string) => void;
  onServiceChange: (service: string) => void;
}

function Dropdown({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle)] text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {label}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 py-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] shadow-xl min-w-[140px]"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MonitoringFilterBar({
  services,
  level,
  timeRange,
  service,
  onLevelChange,
  onTimeRangeChange,
  onServiceChange,
}: MonitoringFilterBarProps) {
  const timeLabel =
    TIME_RANGE_OPTIONS.find((o) => o.value === timeRange)?.label ?? "Last 24h";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] p-0.5 bg-[var(--color-bg-subtle)]">
        {LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onLevelChange(opt)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              level === opt
                ? "bg-[var(--color-bg-panel)] text-[var(--color-text-primary)] shadow-sm"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
            )}
          >
            <span className="flex items-center gap-1.5">
              {level === opt && <Check className="w-3 h-3" />}
              {opt === "all"
                ? "All"
                : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </span>
          </button>
        ))}
      </div>

      <Dropdown label={timeLabel}>
        {TIME_RANGE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onTimeRangeChange(value)}
            className={cn(
              "w-full px-3 py-2 text-left text-xs flex items-center gap-2",
              timeRange === value
                ? "text-[var(--color-text-primary)] bg-[var(--color-bg-hover)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
            )}
          >
            {timeRange === value && <Check className="w-3 h-3" />}
            {label}
          </button>
        ))}
      </Dropdown>

      {services.length > 0 && (
        <Dropdown label={service || "All services"} className="min-w-[140px]">
          <div className="min-w-[160px] max-h-[200px] overflow-y-auto">
            <button
              type="button"
              onClick={() => onServiceChange("")}
              className={cn(
                "w-full px-3 py-2 text-left text-xs flex items-center gap-2",
                !service
                  ? "text-[var(--color-text-primary)] bg-[var(--color-bg-hover)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
              )}
            >
              {!service && <Check className="w-3 h-3" />}
              All services
            </button>
            {services.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onServiceChange(s)}
                className={cn(
                  "w-full px-3 py-2 text-left text-xs flex items-center gap-2",
                  service === s
                    ? "text-[var(--color-text-primary)] bg-[var(--color-bg-hover)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
                )}
              >
                {service === s && <Check className="w-3 h-3" />}
                {s}
              </button>
            ))}
          </div>
        </Dropdown>
      )}
    </div>
  );
}

export function useMonitoringFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const level = searchParams.get("level") ?? "all";
  const timeRange = searchParams.get("time") ?? "24h";
  const service = searchParams.get("service") ?? "";

  const setParams = useCallback(
    (updates: { level?: string; time?: string; service?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.level != null) params.set("level", updates.level);
      if (updates.time != null) params.set("time", updates.time);
      if (updates.service != null) params.set("service", updates.service);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return {
    level,
    timeRange,
    service,
    onLevelChange: (v: string) => setParams({ level: v }),
    onTimeRangeChange: (v: string) => setParams({ time: v }),
    onServiceChange: (v: string) => setParams({ service: v }),
  };
}

function normalizeLevel(l: string): string {
  const s = (l ?? "info").toLowerCase();
  return s === "warning" ? "warn" : s;
}

export function filterLogsByParams<
  T extends { level?: string; timestamp?: string; service?: string },
>(logs: T[], level: string, timeRange: string, service: string): T[] {
  let result = logs;

  if (level && level !== "all") {
    result = result.filter((e) => normalizeLevel(e.level ?? "info") === level);
  }

  if (service) {
    result = result.filter(
      (e) => (e.service ?? "").toLowerCase() === service.toLowerCase(),
    );
  }

  if (timeRange) {
    const now = Date.now();
    const ms =
      timeRange === "1h"
        ? 60 * 60 * 1000
        : timeRange === "24h"
          ? 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - ms;
    result = result.filter((e) => {
      const ts = e.timestamp;
      if (!ts) return true;
      const t = typeof ts === "string" ? new Date(ts).getTime() : 0;
      return t >= cutoff;
    });
  }

  return result;
}
