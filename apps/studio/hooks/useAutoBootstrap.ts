'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useSignInWithWallet } from '@/hooks/useSignInWithWallet';
import { clearStoredSession, getStoredSession } from '@/lib/session-store';
import { redirectToLoginWithNext } from '@/lib/authRedirect';

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
          redirectToLoginWithNext();
        }
      })
      .catch(() => {
        clearStoredSession();
        redirectToLoginWithNext();
      })
      .finally(() => {
        bootstrappingRef.current = false;
      });
  }, [account?.address, signIn]);
}
