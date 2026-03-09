'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { setAuthHeaderProvider, setOn401Callback } from '@/lib/api';
import { getStoredSession, clearStoredSession } from '@/lib/session-store';

/**
 * Wires gateway session (our JWT) to the API client. Every request to the gateway
 * includes Authorization: Bearer <access_token> from the session store.
 * On 401, clears session and shows toast so the user knows to sign in again.
 * Auth is wallet-only (SIWE); Supabase is database-only, not used for API auth.
 */
export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
      const session = getStoredSession();
      return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
    });
    setOn401Callback(() => {
      clearStoredSession();
      toast.error('Session expired or not signed in. Please sign in again.');
    });
    return () => {
      setAuthHeaderProvider(null);
      setOn401Callback(null);
    };
  }, []);

  return <>{children}</>;
}
