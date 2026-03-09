"use client";

import { useActiveAccount, useConnectModal } from "thirdweb/react";
import { useSignInWithWallet } from "@/hooks/useSignInWithWallet";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { CONNECT_WALLETS } from "@/lib/connectWallets";
import { Loader2, Wallet } from "lucide-react";

export interface SessionGateProps {
  title?: string;
  description?: string;
}

/**
 * Connect wallet + Sign in gate. Used on /login and by RequireApiSession.
 */
export function SessionGate({
  title = "Sign in to continue",
  description = "Connect your wallet and sign in so Hyperkit can securely manage your runs, workflows, and LLM keys (stored encrypted at rest).",
}: SessionGateProps) {
  const account = useActiveAccount();
  const { signIn, isLoading, error } = useSignInWithWallet();
  const { connect, isConnecting } = useConnectModal();
  const client = getThirdwebClient();

  const handleConnect = () => {
    if (client) {
      connect({ client, wallets: CONNECT_WALLETS });
    }
  };

  return (
    <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full glass-panel rounded-xl p-6 space-y-4">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          {title}
        </h1>
        <p className="text-[var(--color-text-tertiary)] text-sm">
          {description}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {!account ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={!client || isConnecting}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50"
            >
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              {isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isLoading ? "Signing in..." : "Sign in with wallet"}
            </button>
          )}
        </div>
        {!client && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Wallet connection is not configured. Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env.
          </p>
        )}
        {error && (
          <p className="text-xs text-[var(--color-semantic-error)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
