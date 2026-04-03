'use client';

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useActiveAccount } from 'thirdweb/react';
import { setAuthHeaderProvider, setOn401Callback } from '@/lib/api';
import {
  getStoredSession,
  clearStoredSession,
  setStoredSession,
  clearExpiredSessionIfNeeded,
  getSessionTimeToExpiry,
  SESSION_CHANGE_EVENT,
} from '@/lib/session-store';
import { redirectToLoginWithNext } from '@/lib/authRedirect';
import {
  SESSION_EXPIRED_SOON_TOAST,
  SESSION_EXPIRED_TOAST,
  SESSION_INVALIDATED_TOAST,
} from '@/lib/sadPathCopy';
import { bootstrapWithThirdwebInApp } from '@/lib/authBootstrap';

const SILENT_REFRESH_BUFFER_SEC = 120;
const REDIRECT_BUFFER_SEC = 300;

/**
 * Wires gateway session (our JWT) to the API client. Every request to the gateway
 * includes Authorization: Bearer <access_token> from the session store.
 * On 401, clears session, shows toast, and redirects to /login?next=.
 * Schedules a proactive redirect 5 min before JWT expiry so users do not lose work mid-flow.
 */
export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const account = useActiveAccount();
  const refreshAttemptedRef = useRef(false);

  const attemptSilentRefresh = useCallback(async (): Promise<boolean> => {
    if (refreshAttemptedRef.current) return false;
    refreshAttemptedRef.current = true;

    if (!account?.address) return false;

    const getAuthToken = (account as { getAuthToken?: () => Promise<string> }).getAuthToken;
    if (typeof getAuthToken !== 'function') return false;

    try {
      const session = await bootstrapWithThirdwebInApp({
        walletAddress: account.address,
        getAuthToken,
      });
      setStoredSession(session.access_token, session.expires_in);
      refreshAttemptedRef.current = false;
      return true;
    } catch {
      refreshAttemptedRef.current = false;
      return false;
    }
  }, [account]);

  useEffect(() => {
    setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
      const session = getStoredSession();
      return session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
    });
    setOn401Callback(() => {
      clearStoredSession();
      toast.error(SESSION_INVALIDATED_TOAST);
      redirectToLoginWithNext();
    });
    return () => {
      setAuthHeaderProvider(null);
      setOn401Callback(null);
    };
  }, []);

  useEffect(() => {
    let refreshTimerId: number | undefined;
    let redirectTimerId: number | undefined;

    function scheduleTimers() {
      if (refreshTimerId != null) clearTimeout(refreshTimerId);
      if (redirectTimerId != null) clearTimeout(redirectTimerId);
      refreshTimerId = undefined;
      redirectTimerId = undefined;

      if (clearExpiredSessionIfNeeded()) {
        toast.error(SESSION_EXPIRED_TOAST);
        redirectToLoginWithNext();
        return;
      }

      const ttl = getSessionTimeToExpiry();
      if (ttl <= 0) return;

      const refreshDelay = Math.max((ttl - SILENT_REFRESH_BUFFER_SEC) * 1000, 0);
      refreshTimerId = window.setTimeout(async () => {
        const ok = await attemptSilentRefresh();
        if (ok) {
          scheduleTimers();
        }
      }, refreshDelay);

      const redirectDelay = Math.max((ttl - REDIRECT_BUFFER_SEC) * 1000, 0);
      redirectTimerId = window.setTimeout(() => {
        clearStoredSession();
        toast.error(SESSION_EXPIRED_SOON_TOAST);
        redirectToLoginWithNext();
      }, redirectDelay);
    }

    scheduleTimers();

    const onSessionChange = () => {
      refreshAttemptedRef.current = false;
      scheduleTimers();
    };
    window.addEventListener(SESSION_CHANGE_EVENT, onSessionChange);

    return () => {
      if (refreshTimerId != null) clearTimeout(refreshTimerId);
      if (redirectTimerId != null) clearTimeout(redirectTimerId);
      window.removeEventListener(SESSION_CHANGE_EVENT, onSessionChange);
    };
  }, [attemptSilentRefresh]);

  return <>{children}</>;
}
