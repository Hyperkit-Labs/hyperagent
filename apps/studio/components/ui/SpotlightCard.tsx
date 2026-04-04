"use client";

import { useRef, useState, type ReactNode } from "react";

export interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card with a spotlight gradient that follows the cursor on hover.
 */
export function SpotlightCard({
  children,
  className = "",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [hover, setHover] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPos({ x: 50, y: 50 });
      }}
      className={`relative overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/60 backdrop-blur-sm hover:border-[var(--color-primary-alpha-30)] transition-all duration-200 ${className}`}
    >
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{
            background: `radial-gradient(ellipse 80% 80% at ${pos.x}% ${pos.y}%, var(--color-primary-alpha-15), transparent 60%)`,
          }}
          aria-hidden
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
