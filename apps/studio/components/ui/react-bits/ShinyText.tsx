"use client";

import React from "react";
import { motion } from "framer-motion";

export const ShinyText = ({
  text,
  className = "",
  disabled = false,
  speed = 3,
}: {
  text: string;
  className?: string;
  disabled?: boolean;
  speed?: number;
}) => {
  return (
    <motion.span
      className={`inline-block text-transparent bg-clip-text ${
        disabled ? "" : "animate-shine"
      } ${className}`}
      style={
        !disabled
          ? {
              backgroundImage: "linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.8) 50%, rgba(255, 255, 255, 0) 60%)",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text",
              animationDuration: `${speed}s`,
            }
          : {}
      }
    >
      {text}
    </motion.span>
  );
};
