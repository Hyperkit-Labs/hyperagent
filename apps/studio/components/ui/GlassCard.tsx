"use client";

import { type ReactNode } from "react";

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  /** If true, adds hover lift. Default false. */
  hover?: boolean;
}

export function GlassCard({ children, className = "", hover = false }: GlassCardProps) {
  return (
    <div
      className={`glass-panel rounded-xl ${hover ? "hover:translate-y-[-2px] transition-transform duration-300" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
