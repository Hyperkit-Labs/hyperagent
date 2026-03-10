"use client";

import { useActiveAccount, useConnectModal } from "thirdweb/react";
import { useSignInWithWallet } from "@/hooks/useSignInWithWallet";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { CONNECT_WALLETS } from "@/lib/connectWallets";
import { Loader2, Wallet, Smartphone, CreditCard, Globe } from "lucide-react";

export interface SessionGateProps {
  title?: string;
  description?: string;
  noWrapper?: boolean;
}

const WALLET_LABELS = ["MetaMask", "WalletConnect", "Coinbase Wallet", "Google"];

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
      connect({ client, wallets: CONNECT_WALLETS });
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
        {isConnectState && client && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <p className="text-[10px] text-[var(--color-text-muted)] text-center">
              Supported: {WALLET_LABELS.join(", ")}
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]" title="MetaMask">
                <Wallet className="w-3.5 h-3.5" />
              </span>
              <span className="w-7 h-7 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]" title="WalletConnect">
                <Smartphone className="w-3.5 h-3.5" />
              </span>
              <span className="w-7 h-7 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]" title="Coinbase Wallet">
                <CreditCard className="w-3.5 h-3.5" />
              </span>
              <span className="w-7 h-7 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-text-tertiary)]" title="Google">
                <Globe className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
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
