'use client';

import { useEffect, useRef } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useSignInWithWallet } from '@/hooks/useSignInWithWallet';
import { getStoredSession } from '@/lib/session-store';

/**
 * ZSPS: Proactive session bootstrap.
 * When AutoConnect restores wallet but no valid session exists, triggers bootstrap
 * so wallet_users is updated and a fresh JWT is issued.
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
      .finally(() => {
        bootstrappingRef.current = false;
      });
  }, [account?.address, signIn]);
}
