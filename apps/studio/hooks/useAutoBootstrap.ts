'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { useSignInWithWallet } from '@/hooks/useSignInWithWallet';
import { getStoredSession } from '@/lib/session-store';
import { ROUTES } from '@/constants/routes';

/**
 * ZSPS: Proactive session bootstrap.
 * When AutoConnect restores wallet but no valid session exists, triggers bootstrap
 * so wallet_users is updated and a fresh JWT is issued.
 * On failure, redirects to login to avoid ghost state (wallet connected, no session).
 */
export function useAutoBootstrap(): void {
  const account = useActiveAccount();
  const { signIn } = useSignInWithWallet();
  const router = useRouter();
  const bootstrappingRef = useRef(false);

  useEffect(() => {
    if (!account) return;
    const session = getStoredSession();
    if (session) return;
    if (bootstrappingRef.current) return;

    bootstrappingRef.current = true;
    signIn()
      .then((ok) => {
        if (!ok) router.replace(ROUTES.LOGIN);
      })
      .catch(() => {
        router.replace(ROUTES.LOGIN);
      })
      .finally(() => {
        bootstrappingRef.current = false;
      });
  }, [account?.address, signIn, router]);
}
