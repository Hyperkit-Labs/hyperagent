"use client";

import { type ReactNode } from "react";
import { GlassCard } from "./GlassCard";

export interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  /** Optional loading slot (e.g. ShimmerTableRows). */
  loading?: ReactNode;
  /** Optional empty state slot when not loading and no rows. */
  empty?: ReactNode;
  isEmpty?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function DataTable({
  headers,
  children,
  loading,
  empty,
  isEmpty = false,
  isLoading = false,
  className = "",
}: DataTableProps) {
  const colCount = headers.length;
  return (
    <GlassCard className={`overflow-hidden ${className}`.trim()}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs custom-table">
          <thead>
            <tr className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-bg-surface)]/50 border-b border-[var(--color-border-subtle)]">
              {headers.map((h, i) => (
                <th key={i} className="px-6 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && loading}
            {!isLoading && isEmpty && empty && (
              <tr>
                <td colSpan={colCount} className="px-6 py-12">
                  {empty}
                </td>
              </tr>
            )}
            {!isLoading && !isEmpty && children}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
