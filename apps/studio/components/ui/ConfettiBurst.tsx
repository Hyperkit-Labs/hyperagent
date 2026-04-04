"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  "var(--color-primary-light)",
  "var(--color-semantic-success)",
  "var(--color-semantic-warning)",
  "var(--color-semantic-info)",
];

function Particle({
  delay,
  color,
  dx,
  dy,
}: {
  delay: number;
  color: string;
  dx: number;
  dy: number;
}) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{
        left: "50%",
        top: "40%",
        marginLeft: -4,
        marginTop: -4,
        backgroundColor: color,
      }}
      initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      animate={{
        opacity: 0,
        scale: 0.5,
        x: dx,
        y: dy,
      }}
      transition={{
        duration: 1.2,
        delay,
        ease: "easeOut",
      }}
    />
  );
}

export interface ConfettiBurstProps {
  active: boolean;
  onComplete?: () => void;
}

export function ConfettiBurst({ active, onComplete }: ConfettiBurstProps) {
  const [particles] = useState(() =>
    Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360 + Math.random() * 30;
      const rad = (angle * Math.PI) / 180;
      const r = 80 + Math.random() * 120;
      return {
        id: i,
        delay: i * 0.02,
        color: COLORS[i % COLORS.length],
        dx: Math.cos(rad) * r,
        dy: Math.sin(rad) * r,
      };
    }),
  );

  useEffect(() => {
    if (active && onComplete) {
      const t = setTimeout(onComplete, 1500);
      return () => clearTimeout(t);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <div
          className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center"
          aria-hidden
        >
          {particles.map((p) => (
            <Particle
              key={p.id}
              delay={p.delay}
              color={p.color}
              dx={p.dx}
              dy={p.dy}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
