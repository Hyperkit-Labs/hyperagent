"use client";

import { usePathname } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useConfig } from "@/components/providers/ConfigProvider";
import { handleApiError } from "@/lib/api";

/**
 * Non-blocking banner when runtime config failed to load (502, timeout, etc.).
 * Surfaces retry so protected reads are not silently assumed healthy.
 */
export function StudioBootstrapAlert() {
  const pathname = usePathname();
  const { configError, loading, retryConfig } = useConfig();

  if (pathname === ROUTES.LOGIN || !configError || loading) return null;

  const msg = handleApiError(configError);

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <span className="truncate">
          <strong className="font-medium">Configuration unavailable.</strong>{" "}
          {msg} Protected data may not load until this succeeds.
        </span>
      </div>
      <button
        type="button"
        onClick={() => retryConfig()}
        className="shrink-0 rounded-md border border-amber-400/40 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-500/20"
      >
        Retry
      </button>
    </div>
  );
}
