"use client";

import { useEffect, useState } from "react";
import { useSpring } from "framer-motion";

export interface NumberTickerProps {
  value: number | string;
  className?: string;
  duration?: number;
}

/**
 * Animated number counter. Animates from 0 to value when value is numeric.
 * For non-numeric values, renders as-is without animation.
 */
export function NumberTicker({
  value,
  className = "",
  duration = 0.8,
}: NumberTickerProps) {
  const numeric = typeof value === "number" && !Number.isNaN(value);
  const target = numeric ? value : 0;

  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  const [display, setDisplay] = useState(numeric ? 0 : value);

  useEffect(() => {
    if (numeric) {
      spring.set(target);
    } else {
      setDisplay(value);
    }
  }, [target, value, numeric, spring]);

  useEffect(() => {
    if (!numeric) return;
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [numeric, spring]);

  if (!numeric) {
    return <span className={className}>{String(value)}</span>;
  }

  return <span className={className}>{display}</span>;
}
