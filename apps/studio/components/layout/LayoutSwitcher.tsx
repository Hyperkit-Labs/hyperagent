"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { ActiveAccountProvider } from "@/components/providers/ActiveAccountContext";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { AppBar } from "@/components/layout/AppBar";
import { ContextSidebar } from "@/components/layout/ContextSidebar";
import { FloatingLogsPill } from "@/components/layout/FloatingLogsPill";
import { SlimNav } from "@/components/layout/SlimNav";
import { StatusDock } from "@/components/layout/StatusDock";
import { OrchestratorRail } from "@/components/layout/OrchestratorRail";
import { useLayout } from "@/components/providers/LayoutProvider";
import { useSession } from "@/hooks/useSession";
import { FULL_PAGE_ROUTES, PUBLIC_ROUTE } from "@/constants/routes";

function ContextSidebarWrapper() {
  const { contextSidebarOpen, setContextSidebarOpen } = useLayout();
  return (
    <ContextSidebar
      open={contextSidebarOpen}
      onClose={() => setContextSidebarOpen(false)}
    />
  );
}

export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const account = useActiveAccount();
  const { isReady: sessionReady, hasSession } = useSession();
  const walletAddress = account?.address;
  const hasWallet = Boolean(walletAddress);

  useEffect(() => {
    if (!pathname || pathname === PUBLIC_ROUTE) return;
    if (!sessionReady) return;
    if (hasSession) return;
    if (account !== undefined && !hasWallet) {
      router.replace(PUBLIC_ROUTE);
    }
  }, [
    pathname,
    sessionReady,
    hasSession,
    account,
    walletAddress,
    hasWallet,
    router,
  ]);

  const isFullPage = pathname && FULL_PAGE_ROUTES.includes(pathname);

  if (
    pathname &&
    pathname !== PUBLIC_ROUTE &&
    sessionReady &&
    !hasSession &&
    account !== undefined &&
    !hasWallet
  ) {
    return null;
  }

  const wrappedChildren = (
    <ActiveAccountProvider account={account}>{children}</ActiveAccountProvider>
  );

  if (pathname === PUBLIC_ROUTE) {
    return <>{wrappedChildren}</>;
  }

  if (isFullPage) {
    return <>{wrappedChildren}</>;
  }

  return (
    <>
      <AmbientBackground />
      <div className="flex flex-col flex-1 min-h-0 z-10 relative">
        <AppBar />
        <div className="flex flex-1 overflow-hidden min-h-0">
          <SlimNav />
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            <main className="flex-1 overflow-y-auto bg-[var(--color-bg-base)] relative scroll-smooth min-h-0 min-w-0">
              {wrappedChildren}
            </main>
            <StatusDock />
            <FloatingLogsPill />
          </div>
          <OrchestratorRail />
          <Suspense fallback={null}>
            <ContextSidebarWrapper />
          </Suspense>
        </div>
      </div>
    </>
  );
}
