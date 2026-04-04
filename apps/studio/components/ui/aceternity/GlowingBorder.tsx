"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function GlowingBorder({
  children,
  className = "",
  containerClassName = "",
  as: Tag = "div",
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  as?: React.ElementType;
  active?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isActive = hovered || active;

  return (
    <Tag
      className={`relative group overflow-hidden rounded-xl ${containerClassName}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="absolute inset-0 z-0 bg-transparent transition-all duration-300 pointer-events-none"
        style={{
          boxShadow: isActive
            ? "inset 0 0 20px rgba(124, 58, 237, 0.2)"
            : "inset 0 0 0px transparent",
        }}
      />

      {/* Animated gradient border on hover */}
      <motion.div
        className="absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.5), transparent)",
          height: "2px",
          top: 0,
          left: "-100%",
          width: "200%",
          opacity: isActive ? 1 : 0,
        }}
        animate={{
          left: isActive ? "100%" : "-100%",
        }}
        transition={{
          duration: 1,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      <div className={`relative z-10 ${className}`}>{children}</div>
    </Tag>
  );
}
