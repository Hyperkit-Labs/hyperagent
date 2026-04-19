"use client";

import { cn } from "@/lib/utils";

export interface LogoLoopItem {
  id: string;
  node: React.ReactNode;
}

export interface LogoLoopProps {
  items: LogoLoopItem[];
  className?: string;
  /** Row duration in seconds */
  durationSec?: number;
}

/**
 * Infinite horizontal marquee (React Bits LogoLoop-style). Duplicate items for seamless loop.
 */
export function LogoLoop({
  items,
  className = "",
  durationSec = 28,
}: LogoLoopProps) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden mask-linear-fade",
        className,
      )}
      aria-label="Partner logos"
    >
      <div
        className="flex w-max gap-8 md:gap-12 animate-logo-marquee items-center py-1"
        style={{
          animationDuration: `${durationSec}s`,
        }}
      >
        {doubled.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="flex h-10 w-28 shrink-0 items-center justify-center md:h-12 md:w-36 opacity-90"
          >
            {item.node}
          </div>
        ))}
      </div>
    </div>
  );
}
