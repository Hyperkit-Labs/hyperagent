"use client";

import { motion } from "framer-motion";

export interface LiveIndicatorProps {
  /** Whether the card is receiving live updates (e.g. via SSE). */
  live?: boolean;
  className?: string;
}

export function LiveIndicator({ live = false, className = "" }: LiveIndicatorProps) {
  if (!live) return null;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-medium ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      Live
    </motion.span>
  );
}
