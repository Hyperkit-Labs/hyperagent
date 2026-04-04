"use client";

import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { GlassCard } from "./GlassCard";
import { NumberTicker } from "./NumberTicker";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  className?: string;
  hover?: boolean;
  /** Optional sparkline data: array of { value: number } for mini chart. */
  sparklineData?: { value: number }[];
  /** Optional trend: up (green), down (red), or neutral. */
  trend?: "up" | "down" | "neutral";
  /** When true and value is number, use NumberTicker for animated count-up. */
  animateValue?: boolean;
}

export function MetricCard({
  label,
  value,
  sublabel,
  icon,
  className = "",
  hover = true,
  sparklineData,
  trend,
  animateValue,
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const scale = hover && isHovered ? 1.02 : 1;

  return (
    <motion.div
      layout
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ scale }}
      transition={{ duration: 0.2 }}
      className="origin-center"
    >
      <GlassCard
        className={`p-5 flex flex-col justify-between min-h-[180px] transition-all duration-200 ${isHovered && hover ? "border-[var(--color-primary-alpha-30)] shadow-[0_0_20px_rgba(124,58,237,0.1)]" : ""} ${className}`.trim()}
        hover={false}
      >
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-tertiary)] text-xs font-medium">
            {label}
          </span>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-semibold text-[var(--color-text-primary)] tracking-tight flex items-center gap-2">
            {animateValue &&
            typeof value === "number" &&
            !Number.isNaN(value) ? (
              <NumberTicker value={value} />
            ) : (
              value
            )}
            {trend === "up" && (
              <TrendingUp
                className="w-4 h-4 text-[var(--color-semantic-success)] shrink-0"
                aria-hidden
              />
            )}
            {trend === "down" && (
              <TrendingDown
                className="w-4 h-4 text-[var(--color-semantic-error)] shrink-0"
                aria-hidden
              />
            )}
          </div>
          {sublabel && (
            <span className="text-[11px] text-[var(--color-text-dim)] mt-1 block">
              {sublabel}
            </span>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 h-12 w-full opacity-80">
            <ResponsiveContainer width="100%" height={48}>
              <AreaChart
                data={sparklineData}
                margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
              >
                <defs>
                  <linearGradient
                    id={`metric-grad-${label.replace(/\W/g, "-")}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--color-primary-mid)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-primary-mid)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary-mid)"
                  strokeWidth={1}
                  fill={`url(#metric-grad-${label.replace(/\W/g, "-")})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
