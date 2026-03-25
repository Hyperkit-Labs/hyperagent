"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { getLoginRedirectHref } from "@/lib/authRedirect";
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
    // Only redirect when there is no JWT. Do not redirect on bootstrapStatus === "failed"
    // while hasSession is true — transient /config errors would ping-pong login ↔ app.
    if (!hasSession) {
      router.replace(getLoginRedirectHref());
    }
  }, [isReady, hasSession, router]);

  if (!isReady || !hasSession || bootstrapStatus === "failed" || bootstrapStatus === "pending") {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

