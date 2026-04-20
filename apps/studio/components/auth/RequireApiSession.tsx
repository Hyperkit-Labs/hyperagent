"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSessionContext } from "@/components/providers/SessionProvider";
import { getLoginRedirectHref } from "@/lib/authRedirect";
import { ROUTES } from "@/constants/routes";
import {
  SessionPrepSkeleton,
  SettingsBootstrapSkeleton,
  GenericBootstrapSkeleton,
} from "@/components/settings/WorkspaceSettingsSkeleton";

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
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady) return;
    if (!hasSession) {
      router.replace(getLoginRedirectHref());
    }
  }, [isReady, hasSession, router]);

  if (!isReady || !hasSession) {
    return <SessionPrepSkeleton />;
  }

  if (bootstrapStatus === "pending") {
    return pathname === ROUTES.SETTINGS ? (
      <SettingsBootstrapSkeleton />
    ) : (
      <GenericBootstrapSkeleton />
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
