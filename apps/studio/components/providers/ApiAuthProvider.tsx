'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { setAuthHeaderProvider, setOn401Callback } from '@/lib/api';
import { getStoredSession, clearStoredSession, getSessionTimeToExpiry, SESSION_CHANGE_EVENT } from '@/lib/session-store';
import { ROUTES } from '@/constants/routes';

const REFRESH_BUFFER_SEC = 300; // redirect 5 min before expiry

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  const next = path && path !== ROUTES.LOGIN ? encodeURIComponent(path) : '';
  window.location.href = next ? `${ROUTES.LOGIN}?next=${next}` : ROUTES.LOGIN;
}

/**
 * Wires gateway session (our JWT) to the API client. Every request to the gateway
 * includes Authorization: Bearer <access_token> from the session store.
 * On 401, clears session, shows toast, and redirects to /login?next=.
 * Schedules a proactive redirect 5 min before JWT expiry so users do not lose work mid-flow.
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
      redirectToLogin();
    });
    return () => {
      setAuthHeaderProvider(null);
      setOn401Callback(null);
    };
  }, []);

  useEffect(() => {
    function scheduleExpiryRedirect() {
      const ttl = getSessionTimeToExpiry();
      if (ttl <= 0) return undefined;
      const delay = Math.max((ttl - REFRESH_BUFFER_SEC) * 1000, 0);
      return window.setTimeout(() => {
        clearStoredSession();
        toast.error('Session is about to expire. Please sign in again.');
        redirectToLogin();
      }, delay);
    }

    let timerId = scheduleExpiryRedirect();

    const onSessionChange = () => {
      if (timerId != null) clearTimeout(timerId);
      timerId = scheduleExpiryRedirect();
    };
    window.addEventListener(SESSION_CHANGE_EVENT, onSessionChange);

    return () => {
      if (timerId != null) clearTimeout(timerId);
      window.removeEventListener(SESSION_CHANGE_EVENT, onSessionChange);
    };
  }, []);

  return <>{children}</>;
}
