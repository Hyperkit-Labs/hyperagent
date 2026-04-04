/**
 * Design Tokens System
 *
 * Mirrors styles/theme.css for use in JS/TS (e.g. charts, inline styles).
 * Source of truth for color values is theme.css; keep these in sync.
 */

export const tokens = {
  colors: {
    // Background hierarchy (sync with theme.css :root)
    bg: {
      base: "#020617",
      elevated: "#050814",
      overlay: "#030205",
      surface: "#0B1020",
      hover: "#18181B",
    },
    // Border hierarchy (sync with theme.css)
    border: {
      subtle: "#1F1F22",
      default: "#27272A",
      strong: "#3F3F46",
    },
    // Text hierarchy (sync with theme.css)
    text: {
      primary: "#F9FAFB",
      secondary: "#E5E7EB",
      tertiary: "#9CA3AF",
      muted: "#6B7280",
    },
    // Semantic colors
    semantic: {
      success: "#10B981", // emerald-500
      warning: "#F59E0B", // amber-500
      error: "#EF4444", // red-500
      info: "#3B82F6", // blue-500
      violet: "#8B5CF6", // violet-500
    },
    // Semantic colors with opacity (for backgrounds)
    semanticBg: {
      success: "rgba(16, 185, 129, 0.10)", // emerald-500/10
      warning: "rgba(245, 158, 11, 0.10)", // amber-500/10
      error: "rgba(239, 68, 68, 0.10)", // red-500/10
      info: "rgba(59, 130, 246, 0.10)", // blue-500/10
      violet: "rgba(139, 92, 246, 0.10)", // violet-500/10
    },
    semanticBorder: {
      success: "rgba(16, 185, 129, 0.20)", // emerald-500/20
      warning: "rgba(245, 158, 11, 0.20)", // amber-500/20
      error: "rgba(239, 68, 68, 0.20)", // red-500/20
      info: "rgba(59, 130, 246, 0.20)", // blue-500/20
      violet: "rgba(139, 92, 246, 0.20)", // violet-500/20
    },
    semanticText: {
      success: "#10B981", // emerald-500
      warning: "#F59E0B", // amber-500
      error: "#EF4444", // red-500
      info: "#3B82F6", // blue-500
      violet: "#8B5CF6", // violet-500
    },
  },
  spacing: {
    // 4px base grid system
    xs: "0.25rem", // 4px
    sm: "0.5rem", // 8px
    md: "1rem", // 16px
    lg: "1.5rem", // 24px
    xl: "2rem", // 32px
    "2xl": "2.5rem", // 40px
    "3xl": "3rem", // 48px
    "4xl": "4rem", // 64px
  },
  typography: {
    fontFamily: {
      sans: "var(--font-inter)",
      mono: "var(--font-jetbrains-mono)",
    },
    fontSize: {
      xs: "0.75rem", // 12px
      sm: "0.875rem", // 14px
      base: "1rem", // 16px
      lg: "1.125rem", // 18px
      xl: "1.25rem", // 20px
      "2xl": "1.5rem", // 24px
      "3xl": "1.875rem", // 30px
      "4xl": "2.25rem", // 36px
    },
    lineHeight: {
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  borderRadius: {
    sm: "0.375rem", // 6px
    md: "0.5rem", // 8px
    lg: "0.75rem", // 12px
    xl: "1rem", // 16px
    "2xl": "1.5rem", // 24px
  },
  shadows: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px rgba(0, 0, 0, 0.1)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.15)",
  },
  animation: {
    duration: {
      fast: "150ms",
      normal: "200ms",
      slow: "300ms",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
  },
  grid: {
    columnCount: 12,
    gap: {
      sm: "1rem", // 16px
      md: "1.5rem", // 24px
      lg: "2rem", // 32px
    },
    cellSize: "40px", // Grid background cell size
    breakpoints: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
  },
  components: {
    card: {
      padding: {
        sm: "1rem", // 16px
        md: "1.5rem", // 24px
        lg: "2rem", // 32px
      },
    },
    button: {
      height: {
        sm: "2rem", // 32px
        md: "2.5rem", // 40px
        lg: "3rem", // 48px
      },
      padding: {
        sm: "0.5rem 1rem", // 8px 16px
        md: "0.625rem 1.25rem", // 10px 20px
        lg: "0.75rem 1.5rem", // 12px 24px
      },
    },
    input: {
      height: {
        sm: "2.5rem", // 40px
        md: "3rem", // 48px
        lg: "3.5rem", // 56px
      },
      padding: "0.75rem 1rem", // 12px 16px
    },
  },
} as const;

/**
 * Helper function to get Tailwind-compatible class names from tokens
 * Uses CSS custom properties registered in @theme block
 */
export const getTokenClass = {
  bg: (variant: keyof typeof tokens.colors.bg) => {
    const map: Record<keyof typeof tokens.colors.bg, string> = {
      base: "bg-[var(--color-bg-base)]",
      elevated: "bg-[var(--color-bg-elevated)]",
      overlay: "bg-[var(--color-bg-overlay)]",
      surface: "bg-[var(--color-bg-surface)]",
      hover: "bg-[var(--color-bg-hover)]",
    };
    return map[variant];
  },
  border: (variant: keyof typeof tokens.colors.border) => {
    const map: Record<keyof typeof tokens.colors.border, string> = {
      subtle: "border-[var(--color-border-subtle)]",
      default: "border-[var(--color-border-default)]",
      strong: "border-[var(--color-border-strong)]",
    };
    return map[variant];
  },
  text: (variant: keyof typeof tokens.colors.text) => {
    const map: Record<keyof typeof tokens.colors.text, string> = {
      primary: "text-[var(--color-text-primary)]",
      secondary: "text-[var(--color-text-secondary)]",
      tertiary: "text-[var(--color-text-tertiary)]",
      muted: "text-[var(--color-text-muted)]",
    };
    return map[variant];
  },
  semantic: {
    bg: (variant: keyof typeof tokens.colors.semanticBg) => {
      const map: Record<keyof typeof tokens.colors.semanticBg, string> = {
        success: "bg-emerald-500/10",
        warning: "bg-amber-500/10",
        error: "bg-red-500/10",
        info: "bg-blue-500/10",
        violet: "bg-violet-500/10",
      };
      return map[variant];
    },
    border: (variant: keyof typeof tokens.colors.semanticBorder) => {
      const map: Record<keyof typeof tokens.colors.semanticBorder, string> = {
        success: "border-emerald-500/20",
        warning: "border-amber-500/20",
        error: "border-red-500/20",
        info: "border-blue-500/20",
        violet: "border-violet-500/20",
      };
      return map[variant];
    },
    text: (variant: keyof typeof tokens.colors.semanticText) => {
      const map: Record<keyof typeof tokens.colors.semanticText, string> = {
        success: "text-emerald-500",
        warning: "text-amber-500",
        error: "text-red-500",
        info: "text-blue-500",
        violet: "text-violet-500",
      };
      return map[variant];
    },
    textLight: (variant: keyof typeof tokens.colors.semanticText) => {
      const map: Record<keyof typeof tokens.colors.semanticText, string> = {
        success: "text-emerald-400",
        warning: "text-amber-400",
        error: "text-red-400",
        info: "text-blue-400",
        violet: "text-violet-400",
      };
      return map[variant];
    },
  },
  spacing: (variant: keyof typeof tokens.spacing) => {
    return `[padding:var(--spacing-${variant})]`;
  },
  radius: (variant: keyof typeof tokens.borderRadius) => {
    return `rounded-[var(--radius-${variant})]`;
  },
  shadow: (variant: keyof typeof tokens.shadows) => {
    return `shadow-[var(--shadow-${variant})]`;
  },
};

/**
 * Get spacing value as CSS variable or direct value
 */
export function getSpacing(variant: keyof typeof tokens.spacing): string {
  return tokens.spacing[variant];
}

/**
 * Get typography class names
 */
export const getTypographyClass = {
  size: (variant: keyof typeof tokens.typography.fontSize) => {
    return `text-[${tokens.typography.fontSize[variant]}]`;
  },
  weight: (variant: keyof typeof tokens.typography.fontWeight) => {
    return `font-${variant}`;
  },
  lineHeight: (variant: keyof typeof tokens.typography.lineHeight) => {
    return `leading-${variant}`;
  },
};
