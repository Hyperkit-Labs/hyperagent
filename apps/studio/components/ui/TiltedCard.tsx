"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TiltedCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const px = (x / r.width - 0.5) * 14;
    const py = (y / r.height - 0.5) * -14;
    el.style.transform = `perspective(900px) rotateX(${py}deg) rotateY(${px}deg) scale3d(1.01,1.01,1.01)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] transition-transform duration-200 ease-out will-change-transform",
        className,
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}
