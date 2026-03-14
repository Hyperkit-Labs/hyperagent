'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStoredSession, SESSION_CHANGE_EVENT } from '@/lib/session-store';

export interface SessionContextValue {
  isAuthenticated: boolean;
  session: { access_token: string; expires_at: number } | null;
  refetch: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Single source of truth for session state. Combines localStorage, cookie, and in-memory React state.
 * All pages and hooks should use useSession() for isAuthenticated instead of their own logic.
 * 401 handling and redirect remain in ApiAuthProvider.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ access_token: string; expires_at: number } | null>(null);

  const refetch = useCallback(() => {
    setSession(getStoredSession());
  }, []);

  useEffect(() => {
    refetch();
    const onChange = () => refetch();
    window.addEventListener(SESSION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, onChange);
  }, [refetch]);

  const value: SessionContextValue = {
    isAuthenticated: !!session?.access_token,
    session,
    refetch,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}
