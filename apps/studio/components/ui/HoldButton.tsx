"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface HoldButtonProps {
  children: React.ReactNode;
  onHoldComplete: () => void;
  holdMs?: number;
  className?: string;
  disabled?: boolean;
}

export function HoldButton({
  children,
  onHoldComplete,
  holdMs = 1200,
  className = "",
  disabled = false,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const startT = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    startT.current = null;
    setProgress(0);
  }, []);

  const tick = useCallback(() => {
    if (startT.current == null) return;
    const elapsed = Date.now() - startT.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1) {
      onHoldComplete();
      clear();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [holdMs, onHoldComplete, clear]);

  const onDown = () => {
    if (disabled) return;
    startT.current = Date.now();
    setProgress(0);
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onDown}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      className={cn(
        "relative overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] disabled:opacity-50",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 bg-[var(--color-primary-alpha-20)] transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span className="relative z-[1]">{children}</span>
    </button>
  );
}
