"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { useSession } from "@/hooks/useSession";
import { ROUTES } from "@/constants/routes";
import { useServerStatus } from "@/hooks/useServerStatus";
import { CryptoUnavailableBanner } from "@/components/CryptoUnavailableBanner";
import { LoginHero } from "./LoginHero";
import { LoginAuthPanel } from "./LoginAuthPanel";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();
  const { hasSession, isReady } = useSession();
  const serverStatus = useServerStatus();

  const nextParam = searchParams.get("next");
  const walletAddress = account?.address;
  const postLoginRedirectDone = useRef(false);

  useEffect(() => {
    if (!hasSession) postLoginRedirectDone.current = false;
  }, [hasSession]);

  useEffect(() => {
    if (!isReady || !hasSession || !walletAddress) return;
    if (postLoginRedirectDone.current) return;
    postLoginRedirectDone.current = true;
    const destination =
      nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
        ? nextParam
        : ROUTES.HOME;
    router.replace(destination);
  }, [isReady, hasSession, walletAddress, router, nextParam]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-base)] bg-web3">
      <div className="fixed top-4 left-4 right-4 z-20 max-w-md mx-auto">
        <CryptoUnavailableBanner />
      </div>

      {/* Server status badge */}
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            serverStatus === "up"
              ? "bg-emerald-500"
              : serverStatus === "degraded"
                ? "bg-amber-500"
                : serverStatus === "signin_unavailable"
                  ? "bg-amber-500"
                  : serverStatus === "down"
                    ? "bg-red-500"
                    : "animate-pulse bg-amber-500"
          }`}
          aria-hidden
        />
        <span className="text-[var(--color-text-secondary)]">
          {serverStatus === "up"
            ? "Server: Up"
            : serverStatus === "degraded"
              ? "Server: Degraded"
              : serverStatus === "signin_unavailable"
                ? "Sign-in unavailable"
                : serverStatus === "down"
                  ? "Server offline"
                  : "Checking\u2026"}
        </span>
      </div>

      <div className="absolute inset-0 grid-pattern bg-grid" aria-hidden />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[50vw] h-[60vh] max-w-[600px] pointer-events-none hidden lg:block"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 20% 50%, rgba(124, 58, 237, 0.25) 0%, transparent 60%)",
          }}
        />
      </div>

      <div className="relative flex-1 flex flex-col lg:flex-row min-h-screen items-center justify-center">
        <LoginHero />
        <LoginAuthPanel />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)]" />
      }
    >
      <LoginContent />
    </Suspense>
  );
}
