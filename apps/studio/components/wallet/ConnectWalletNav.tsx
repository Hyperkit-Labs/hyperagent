"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useConnectModal,
  useActiveAccount,
  useDisconnect,
  useActiveWallet,
} from "thirdweb/react";
import { toast } from "sonner";
import { getThirdwebClient } from "@/lib/thirdwebClient";
import { getConnectConfig } from "@/lib/connectWallets";
import { useSignInWithWallet } from "@/hooks/useSignInWithWallet";
import {
  clearStoredSession,
  clearSessionOnlyLLMKey,
} from "@/lib/session-store";
import { deleteLLMKeys } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { ROUTES } from "@/constants/routes";

/** Auto-bootstrap OAuth/in-app wallet users so they don't need to click "Sign in with wallet". */
function useAutoBootstrapInApp() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { hasSession, isReady } = useSession();
  const { signIn } = useSignInWithWallet();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasSession || !account || !wallet || attemptedRef.current)
      return;
    const isInApp =
      typeof (wallet as { getAuthToken?: () => Promise<string> })
        .getAuthToken === "function";
    if (!isInApp) return;
    attemptedRef.current = true;
    void signIn();
  }, [isReady, hasSession, account, wallet, signIn]);
}

const walletPillClass =
  "group flex items-center gap-3 pl-1.5 pr-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition-all duration-300";

/**
 * Nav bar "Connect wallet" / connected state.
 * When connected, shows a dropdown: Dashboard, Sign in/Signed in (session-aware), Sign out, Disconnect.
 * When not connected, shows button that opens Thirdweb connect modal.
 */
export function ConnectWalletNav() {
  useAutoBootstrapInApp();
  const pathname = usePathname();
  const client = getThirdwebClient();
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { connect, isConnecting } = useConnectModal();
  const { disconnect } = useDisconnect();
  const {
    signIn,
    isLoading: isSigningIn,
    error: signInError,
  } = useSignInWithWallet();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>(
    [],
  );
  const isDashboard = pathname === ROUTES.DASHBOARD;
  const { hasSession } = useSession();
  const menuId = "studio-wallet-menu";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, hasSession, isDashboard]);

  function focusItem(nextIndex: number) {
    const items = itemRefs.current.filter(Boolean);
    if (items.length === 0) return;
    const safeIndex =
      ((nextIndex % items.length) + items.length) % items.length;
    items[safeIndex]?.focus();
  }

  const handleConnect = () => {
    if (client) {
      connect(getConnectConfig(client));
    } else {
      toast.error(
        "Wallet connection is not configured. Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env and restart the app.",
      );
    }
  };

  const handleDisconnect = async () => {
    setOpen(false);
    const hadSession = hasSession;
    clearSessionOnlyLLMKey();
    if (hadSession) {
      try {
        await deleteLLMKeys();
      } catch {
        // best-effort; session will be cleared locally
      }
      clearStoredSession();
    }
    if (wallet) disconnect(wallet);
    toast.success(
      hadSession
        ? "Disconnected. LLM keys cleared from this device and from the server."
        : "Disconnected. Session cleared.",
    );
  };

  const handleSignInWithWallet = async () => {
    const ok = await signIn();
    setOpen(false);
    if (ok) toast.success("Signed in. API and BYOK are now available.");
    else if (signInError) toast.error(signInError);
  };

  const handleSignOut = async () => {
    setOpen(false);
    clearSessionOnlyLLMKey();
    try {
      await deleteLLMKeys();
    } catch {
      // best-effort
    }
    clearStoredSession();
    toast.success(
      "Signed out. LLM keys cleared from this device and from the server.",
    );
  };

  if (account) {
    let menuItemIndex = 0;
    itemRefs.current = [];
    return (
      <div className="relative" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (
              event.key === "ArrowDown" ||
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              setOpen(true);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          className={walletPillClass}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label="Wallet session controls"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 p-[1px]">
            <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,1)]" />
            </div>
          </div>
          <span className="text-sm font-medium text-slate-300 group-hover:text-white font-mono">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </span>
        </button>
        {open && (
          <div
            id={menuId}
            className="absolute right-0 top-full mt-2 min-w-[180px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] py-1 shadow-lg z-50"
            role="menu"
            onKeyDown={(event) => {
              const currentIndex = itemRefs.current.findIndex(
                (item) => item === document.activeElement,
              );
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  focusItem(currentIndex < 0 ? 0 : currentIndex + 1);
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  focusItem(
                    currentIndex < 0
                      ? itemRefs.current.length - 1
                      : currentIndex - 1,
                  );
                  break;
                case "Home":
                  event.preventDefault();
                  focusItem(0);
                  break;
                case "End":
                  event.preventDefault();
                  focusItem(itemRefs.current.length - 1);
                  break;
                case "Escape":
                  event.preventDefault();
                  setOpen(false);
                  triggerRef.current?.focus();
                  break;
                default:
                  break;
              }
            }}
          >
            {!isDashboard && (
              <Link
                ref={(node: HTMLAnchorElement | null) => {
                  itemRefs.current[menuItemIndex++] = node;
                }}
                href={ROUTES.DASHBOARD}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                role="menuitem"
                tabIndex={-1}
                onClick={() => setOpen(false)}
              >
                Dashboard
              </Link>
            )}
            {hasSession ? (
              <>
                <div
                  className="px-3 py-2 text-sm text-[var(--color-text-muted)]"
                  role="none"
                >
                  Signed in
                </div>
                <button
                  ref={(node) => {
                    itemRefs.current[menuItemIndex++] = node;
                  }}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                ref={(node) => {
                  itemRefs.current[menuItemIndex++] = node;
                }}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
                role="menuitem"
                tabIndex={-1}
                onClick={handleSignInWithWallet}
                disabled={isSigningIn}
              >
                {isSigningIn ? "Signing in..." : "Sign in with wallet"}
              </button>
            )}
            <button
              ref={(node) => {
                itemRefs.current[menuItemIndex++] = node;
              }}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
              role="menuitem"
              tabIndex={-1}
              onClick={handleDisconnect}
            >
              Disconnect wallet
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!client && isDashboard) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      className={`${walletPillClass} disabled:opacity-60`}
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 p-[1px]">
        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,1)]" />
        </div>
      </div>
      <span className="text-sm font-medium text-slate-300 group-hover:text-white font-mono">
        {isConnecting ? "Connecting..." : "Connect wallet"}
      </span>
    </button>
  );
}
