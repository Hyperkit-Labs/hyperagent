"use client";

import { useState, useEffect } from "react";
import { getStoredSession, SESSION_CHANGE_EVENT } from "@/lib/session-store";

export interface UseSessionReturn {
  hasSession: boolean;
  isReady: boolean;
}

/**
 * Single source of truth for API session (JWT in session store).
 * isReady is false until after mount so server and first client render match (no hydration mismatch).
 * Subscribes to session change events so sign-in/sign-out updates all consumers.
 */
export function useSession(): UseSessionReturn {
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
