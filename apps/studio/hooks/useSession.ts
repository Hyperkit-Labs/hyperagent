"use client";

import { useSessionContext, type BootstrapStatus } from "@/components/providers/SessionProvider";

export interface UseSessionReturn {
  hasSession: boolean;
  isReady: boolean;
  bootstrapStatus: BootstrapStatus;
  bootstrapError: string | null;
  recheckBootstrap: () => Promise<void>;
}

/**
 * Single source of truth for API session. Delegates to SessionProvider.
 * Use useSessionContext for the full context value without extra fields.
 */
export function useSession(): UseSessionReturn {
  const { hasSession, isReady, bootstrapStatus, bootstrapError, recheckBootstrap } = useSessionContext();
  return { hasSession, isReady, bootstrapStatus, bootstrapError, recheckBootstrap };
}
