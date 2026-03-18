'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useSignInWithWallet } from '@/hooks/useSignInWithWallet';
import { clearStoredSession, getStoredSession } from '@/lib/session-store';
import { ROUTES } from '@/constants/routes';

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  const next = path && path !== ROUTES.LOGIN ? encodeURIComponent(path) : '';
  window.location.href = next ? `${ROUTES.LOGIN}?next=${next}` : ROUTES.LOGIN;
}

/**
 * Proactive session bootstrap.
 * When AutoConnect restores wallet but no valid session exists, triggers sign-in.
 * On failure: clears session and redirects to /login to close ghost-state window.
 */
export function useAutoBootstrap(): void {
  const account = useActiveAccount();
  const { signIn } = useSignInWithWallet();
  const bootstrappingRef = useRef(false);

  useEffect(() => {
    if (!account) return;
    const session = getStoredSession();
    if (session) return;
    if (bootstrappingRef.current) return;

    bootstrappingRef.current = true;
    signIn()
      .then((ok) => {
        if (!ok) {
          clearStoredSession();
          redirectToLogin();
        }
      })
      .catch(() => {
        clearStoredSession();
        redirectToLogin();
      })
      .finally(() => {
        bootstrappingRef.current = false;
      });
  }, [account?.address, signIn]);
}
