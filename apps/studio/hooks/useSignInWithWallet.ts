"use client";

import { useState, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";
import { signMessage } from "thirdweb/utils";
import { buildSiweMessage, exchangeSiweForSession } from "@/lib/siweAuth";
import { setStoredSession } from "@/lib/session-store";

/**
 * Sign in with Ethereum: build SIWE message, sign with wallet, exchange for our JWT.
 * Gateway verifies SIWE and returns access_token; stored in session store (no Supabase Auth).
 */
export function useSignInWithWallet() {
  const account = useActiveAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!account) {
      setError("Connect your wallet first.");
      return false;
    }
    setIsLoading(true);
    try {
      const domain = typeof window !== "undefined" ? window.location.host : "localhost";
      const chainId = 1;
      const messageBody = buildSiweMessage({
        address: account.address,
        domain,
        chainId,
      });
      const signature = await signMessage({
        message: messageBody,
        account,
      });
      const session = await exchangeSiweForSession(messageBody, signature);
      setStoredSession(session.access_token, session.expires_in);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed.";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  return { signIn, isLoading, error };
}
