/**
 * Grid System Utilities
 * 
 * Helper functions for working with the 12-column grid system
 */

import { tokens } from './design-tokens';

/**
 * Get grid gap class name
 */
export function getGridGap(gap: keyof typeof tokens.grid.gap = 'md'): string {
  const gapMap = {
    sm: 'gap-4',   // 1rem = 16px
    md: 'gap-6',   // 1.5rem = 24px
    lg: 'gap-8',   // 2rem = 32px
  };
  return gapMap[gap];
}

/**
 * Get grid column span class name
 */
export function getGridColSpan(span: number): string {
  if (span < 1 || span > 12) {
    console.warn(`Grid span must be between 1 and 12, got ${span}`);
    return 'col-span-1';
  }
  return `col-span-${span}`;
}

/**
 * Get responsive grid column classes
 */
export function getResponsiveGridCols(config: {
  default?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}): string {
  const classes: string[] = [];
  
  if (config.default) {
    classes.push(`grid-cols-${config.default}`);
  }
  if (config.sm) {
    classes.push(`sm:grid-cols-${config.sm}`);
  }
  if (config.md) {
    classes.push(`md:grid-cols-${config.md}`);
  }
  if (config.lg) {
    classes.push(`lg:grid-cols-${config.lg}`);
  }
  if (config.xl) {
    classes.push(`xl:grid-cols-${config.xl}`);
  }
  
  return classes.join(' ');
}

/**
 * Get grid container class name
 */
export function getGridContainer(columns: number = 12): string {
  return `grid grid-cols-${columns}`;
}

/**
 * Common grid configurations
 */
export const gridConfigs = {
  kpi: {
    default: 1,
    md: 2,
    lg: 4,
  },
  dashboard: {
    default: 1,
    lg: 2,
  },
  table: {
    default: 12,
  },
  form: {
    default: 1,
    md: 2,
  },
} as const;
