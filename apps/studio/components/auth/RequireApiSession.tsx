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
 * If no session, redirect to /login. If bootstrap failed with a retryable error, show message + Retry.
 */
export function RequireApiSession({ children }: RequireApiSessionProps) {
  const {
    hasSession,
    bootstrapStatus,
    isReady,
    bootstrapError,
    recheckBootstrap,
  } = useSessionContext();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!hasSession) {
      router.replace(getLoginRedirectHref());
    }
  }, [isReady, hasSession, router]);

  if (!isReady || !hasSession) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
      </div>
    );
  }

  if (bootstrapStatus === "pending") {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
      </div>
    );
  }

  if (bootstrapStatus === "failed") {
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center">
        <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">
          {bootstrapError ??
            "We could not load your workspace. Your session is still here; try Retry."}
        </p>
        <button
          type="button"
          onClick={() => void recheckBootstrap()}
          className="px-4 py-2 rounded-lg btn-primary-gradient text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
