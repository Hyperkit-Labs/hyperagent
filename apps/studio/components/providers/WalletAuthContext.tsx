'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSignInWithWallet } from '@/hooks/useSignInWithWallet';

interface WalletAuthContextValue {
  signIn: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const WalletAuthContext = createContext<WalletAuthContextValue | null>(null);

/**
 * Provider that uses useSignInWithWallet (requires ThirdwebProvider).
 * Place inside ThirdwebProvider so LLMKeysCard and other components can use
 * sign-in via context without calling thirdweb hooks directly (avoids
 * "useActiveAccount must be used within ThirdwebProvider" when rendered in portals).
 */
export function WalletAuthProvider({ children }: { children: ReactNode }) {
  const { signIn, isLoading, error } = useSignInWithWallet();
  return (
    <WalletAuthContext.Provider value={{ signIn, isLoading, error }}>
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth(): WalletAuthContextValue {
  const ctx = useContext(WalletAuthContext);
  if (!ctx) {
    return {
      signIn: async () => {
        console.warn('WalletAuthProvider not found; sign-in unavailable.');
        return false;
      },
      isLoading: false,
      error: null,
    };
  }
  return ctx;
}
