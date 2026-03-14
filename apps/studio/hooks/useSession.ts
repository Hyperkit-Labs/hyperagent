"use client";

import { useContext, useState, useEffect } from "react";
import { getStoredSession, SESSION_CHANGE_EVENT } from "@/lib/session-store";
import { SessionContext } from "@/components/providers/SessionProvider";

export interface UseSessionReturn {
  hasSession: boolean;
  isReady: boolean;
}

/**
 * Single source of truth for API session. Uses SessionProvider context when available.
 * Falls back to direct session-store read when outside SessionProvider (e.g. login page).
 */
export function useSession(): UseSessionReturn {
  const ctx = useContext(SessionContext);
  if (ctx) {
    return { hasSession: ctx.isAuthenticated, isReady: true };
  }

  const [hasSession, setHasSession] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHasSession(Boolean(getStoredSession()));
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    const handler = () => setHasSession(Boolean(getStoredSession()));
    window.addEventListener(SESSION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  }, []);

  return { hasSession, isReady };
}
