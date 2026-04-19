"use client";

import { motion } from "framer-motion";
import { GridBeam } from "@/components/ui/GridBeam";

export interface PageTitleProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  /** Animated beam under the title block (dashboard / workflow headers) */
  withUnderbeam?: boolean;
}

export function PageTitle({
  title,
  subtitle,
  breadcrumb,
  withUnderbeam = false,
}: PageTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {breadcrumb && (
        <div className="text-sm text-[var(--color-text-tertiary)] mb-1">
          {breadcrumb}
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
          {subtitle}
        </p>
      )}
      {withUnderbeam ? (
        <GridBeam orientation="horizontal" className="max-w-md" />
      ) : null}
    </motion.div>
  );
}
