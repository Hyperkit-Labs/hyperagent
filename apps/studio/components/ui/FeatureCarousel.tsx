"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FeatureCarouselItem {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
}

export interface FeatureCarouselProps {
  items: FeatureCarouselItem[];
  /** Autoplay interval in ms; 0 disables */
  intervalMs?: number;
  className?: string;
  /** Tighter typography and dots for dense layouts */
  compact?: boolean;
  /** Hero / one-screen layouts: minimal padding, clamped description, no fixed min-heights */
  dense?: boolean;
}

export function FeatureCarousel({
  items,
  intervalMs = 6500,
  className = "",
  compact = false,
  dense = false,
}: FeatureCarouselProps) {
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (i: number) => {
      if (!items.length) return;
      setIndex((i + items.length) % items.length);
    },
    [items.length],
  );

  useEffect(() => {
    if (!intervalMs || items.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs, items.length]);

  const active = items[index];
  if (!active) return null;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/60 backdrop-blur-sm",
        dense ? "px-3 py-2" : "px-4 py-3",
        !dense && compact ? "py-2.5" : null,
        !dense && !compact ? "py-4" : null,
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={dense ? "min-h-0" : "min-h-[3.5rem] sm:min-h-[4rem]"}
        >
          {active.eyebrow ? (
            <p
              className={cn(
                "font-semibold uppercase tracking-wider text-[var(--color-text-muted)]",
                dense ? "mb-0.5 text-[8px] leading-none" : "mb-1",
                !dense && compact ? "text-[9px]" : null,
                !dense && !compact ? "text-[10px]" : null,
              )}
            >
              {active.eyebrow}
            </p>
          ) : null}
          <p
            className={cn(
              "font-medium text-[var(--color-text-primary)] leading-tight",
              dense && "text-[13px]",
              compact && !dense && "text-sm",
              !compact && !dense && "text-base",
            )}
          >
            {active.title}
          </p>
          <p
            className={cn(
              "text-[var(--color-text-tertiary)]",
              dense && "mt-0.5 line-clamp-2 text-[11px] leading-snug",
              !dense && "mt-1",
              !dense && compact && "text-xs leading-snug",
              !dense && !compact && "text-sm leading-relaxed",
            )}
          >
            {active.description}
          </p>
        </motion.div>
      </AnimatePresence>

      {items.length > 1 ? (
        <div
          className={cn(
            "flex justify-center gap-1.5",
            dense ? "mt-1.5" : "mt-3",
          )}
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-5 bg-[var(--color-primary-mid)]"
                  : "w-1.5 bg-[var(--color-border-strong)] hover:bg-[var(--color-text-muted)]",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
