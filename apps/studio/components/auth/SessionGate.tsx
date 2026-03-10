"use client";

import { useActiveAccount, useConnectModal } from "thirdweb/react";
import { useSignInWithWallet } from "@/hooks/useSignInWithWallet";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { getConnectConfig } from "@/lib/connectWallets";
import { Loader2, Wallet } from "lucide-react";

export interface SessionGateProps {
  title?: string;
  description?: string;
  noWrapper?: boolean;
}

/**
 * Connect wallet + Sign in gate. Used on /login and by RequireApiSession.
 */
export function SessionGate({
  title = "Sign in to continue",
  description = "Connect your wallet and sign in so Hyperkit can securely manage your runs, workflows, and LLM keys (stored encrypted at rest).",
  noWrapper = false,
}: SessionGateProps) {
  const account = useActiveAccount();
  const { signIn, isLoading, error } = useSignInWithWallet();
  const { connect, isConnecting } = useConnectModal();
  const client = getThirdwebClient();

  const handleConnect = () => {
    if (client) {
      connect(getConnectConfig(client));
    }
  };

  const isConnectState = !account;
  const isBusy = isConnecting || isLoading;

  const content = (
    <div className={`space-y-4 ${noWrapper ? '' : 'max-w-md w-full glass-panel rounded-xl p-6'}`}>
      <h1 className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
        {title}
      </h1>
      <p className="text-[var(--color-text-tertiary)] text-sm">
        {description}
      </p>
      <div className="flex flex-col gap-3">
        {!account ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={!client || isConnecting}
            className={`
              inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg
              btn-primary-gradient text-sm font-medium text-white
              hover:shadow-[0_0_24px_var(--color-primary-alpha-50)] hover:-translate-y-0.5
              disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none
              transition-all duration-200
              ${isConnectState && !isBusy ? "animate-pulse-glow" : ""}
            `}
          >
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg btn-primary-gradient text-sm font-medium text-white hover:shadow-[0_0_24px_var(--color-primary-alpha-50)] hover:-translate-y-0.5 disabled:opacity-50 transition-all duration-200"
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
  );

  if (noWrapper) {
    return content;
  }

  return (
    <div className="p-4 lg:p-6 flex flex-col items-center justify-center">
      {content}
    </div>
  );
}
