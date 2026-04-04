"use client";

export interface ShimmerProps {
  className?: string;
  /** Height in rem or Tailwind class (e.g. "h-4", "h-32"). */
  height?: string;
  /** Width in Tailwind class or "full". */
  width?: string;
  /** Rounded variant. */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "full";
}

const roundedMap = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

export function Shimmer({
  className = "",
  height = "h-4",
  width = "w-full",
  rounded = "md",
}: ShimmerProps) {
  return (
    <div
      className={`shimmer-bg ${roundedMap[rounded]} ${height} ${width} ${className}`}
      aria-hidden
    />
  );
}

export interface ShimmerCardProps {
  className?: string;
}

/** Skeleton for a KPI / glass card. */
export function ShimmerCard({ className = "" }: ShimmerCardProps) {
  return (
    <div
      className={`glass-panel p-5 rounded-xl flex flex-col justify-between h-32 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Shimmer height="h-3" width="w-20" rounded="md" />
        <Shimmer height="h-2" width="w-2" rounded="full" />
      </div>
      <div>
        <Shimmer height="h-8" width="w-16" rounded="md" className="mb-2" />
        <Shimmer height="h-3" width="w-24" rounded="sm" />
      </div>
    </div>
  );
}

export interface ShimmerTableRowsProps {
  rows?: number;
  cols?: number;
  className?: string;
}

/** Skeleton rows for a table. Renders only <tr> elements; wrap in <tbody> yourself. */
export function ShimmerTableRows({
  rows = 5,
  cols = 4,
  className = "",
}: ShimmerTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={className}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-6 py-4">
              <Shimmer height="h-4" width="w-full" rounded="sm" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export interface ShimmerGridProps {
  count?: number;
  className?: string;
}

/** Skeleton grid for card grids (e.g. agents, templates, contracts). */
export function ShimmerGrid({ count = 6, className = "" }: ShimmerGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Shimmer height="h-10" width="w-10" rounded="lg" />
            <div className="flex-1 space-y-2">
              <Shimmer height="h-4" width="w-24" rounded="md" />
              <Shimmer height="h-3" width="w-16" rounded="sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for code block during codegen. Shows "thinking" state. */
export function CodeBlockShimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
        <Shimmer height="h-2" width="w-16" rounded="sm" />
        <Shimmer height="h-2" width="w-2" rounded="full" />
      </div>
      <div className="p-4 space-y-2">
        {["w-2/3", "w-full", "w-1/2", "w-1/3", "w-5/6", "w-4/5", "w-1/2"].map(
          (width, i) => (
            <Shimmer
              key={i}
              height="h-3"
              width={width}
              rounded="sm"
              className="max-w-full"
            />
          ),
        )}
      </div>
    </div>
  );
}
