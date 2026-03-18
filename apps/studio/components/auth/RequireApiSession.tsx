"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { ROUTES } from "@/constants/routes";
import { Loader2 } from "lucide-react";

interface RequireApiSessionProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * If no session or bootstrap failed, redirect to /login. Middleware handles most cases; this is a fallback.
 * Uses SessionProvider for single source of truth.
 */
export function RequireApiSession({ children }: RequireApiSessionProps) {
  const { hasSession, bootstrapStatus, isReady } = useSessionContext();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!hasSession || bootstrapStatus === "failed") {
      const next = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname + window.location.search) : "";
      router.replace(next ? `${ROUTES.LOGIN}?next=${next}` : ROUTES.LOGIN);
    }
  }, [isReady, hasSession, bootstrapStatus, router]);

  if (!isReady || !hasSession || bootstrapStatus === "failed" || bootstrapStatus === "pending") {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

