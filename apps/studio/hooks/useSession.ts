"use client";

import { useSessionContext } from "@/components/providers/SessionProvider";

export interface UseSessionReturn {
  hasSession: boolean;
  isReady: boolean;
}

/**
 * Single source of truth for API session. Delegates to SessionProvider.
 * Use useSessionContext when you also need bootstrapStatus or recheckBootstrap.
 */
export function useSession(): UseSessionReturn {
  const { hasSession, isReady } = useSessionContext();
  return { hasSession, isReady };
}
