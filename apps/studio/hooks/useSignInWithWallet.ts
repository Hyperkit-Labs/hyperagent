"use client";

import { useState, useCallback } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { signMessage } from "thirdweb/utils";
import { bootstrapWithSiwe, bootstrapWithThirdwebInApp } from "@/lib/authBootstrap";
import { setStoredSession } from "@/lib/session-store";

/** Map backend-shaped errors to user-friendly messages. */
function normalizeAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("missing or invalid authorization") || lower.includes("authorization header")) {
    return "Sign-in not completed yet. Connect your wallet and try again.";
  }
  if (lower.includes("invalid or expired token")) {
    return "Session expired. Please sign in again.";
  }
  if (lower.includes("invalid signature")) {
    return "Signature verification failed. Please try signing in again.";
  }
  if (lower.includes("invalid or expired thirdweb")) {
    return "Wallet session expired. Please reconnect and sign in again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Unable to reach server. Check your connection and try again.";
  }
  return raw;
}

/**
 * Sign in: bootstrap backend user for both SIWE (external wallet) and thirdweb OAuth/in-app.
 * Detects in-app wallet via getAuthToken; otherwise uses SIWE. Both upsert wallet_users and return session JWT.
 */
export function useSignInWithWallet() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
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
      const isInAppWallet =
        typeof (wallet as { getAuthToken?: () => Promise<string> } | undefined)?.getAuthToken === "function";

      let session;
      if (isInAppWallet && wallet) {
        const getAuth = (wallet as { getAuthToken?: () => string | null | Promise<string> }).getAuthToken;
        session = await bootstrapWithThirdwebInApp({
          walletAddress: account.address,
          getAuthToken: async () => {
            const token = getAuth ? await Promise.resolve(getAuth.call(wallet)) : null;
            if (!token) throw new Error("No auth token from wallet");
            return token;
          },
        });
      } else {
        session = await bootstrapWithSiwe({
          address: account.address,
          signMessage: async (msg) => {
            const sig = await signMessage({ message: msg, account });
            return sig;
          },
        });
      }
      setStoredSession(session.access_token, session.expires_in);
      return true;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Sign in failed.";
      const msg = normalizeAuthError(raw);
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [account, wallet]);

  return { signIn, isLoading, error };
}
