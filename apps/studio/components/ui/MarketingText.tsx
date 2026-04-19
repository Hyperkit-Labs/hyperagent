"use client";

import type { ElementType, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className = "",
  as: Comp = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Comp
      className={cn(
        "bg-gradient-to-r from-[var(--color-primary-light)] via-[var(--color-primary-mid)] to-[var(--color-semantic-violet)] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </Comp>
  );
}

export function SplitText({
  text,
  className = "",
  wordClassName = "",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.35 }}
          className={cn("inline-block mr-[0.25em]", wordClassName)}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}
