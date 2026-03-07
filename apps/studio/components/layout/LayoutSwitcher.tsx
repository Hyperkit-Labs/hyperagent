"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { AppBar } from "@/components/layout/AppBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { FULL_PAGE_ROUTES, PUBLIC_ROUTE } from "@/constants/routes";

export function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const account = useActiveAccount();

  useEffect(() => {
    if (!pathname || pathname === PUBLIC_ROUTE) return;
    if (account !== undefined && !account) {
      router.replace(PUBLIC_ROUTE);
    }
  }, [pathname, account, router]);

  const isFullPage = pathname && FULL_PAGE_ROUTES.includes(pathname);

  if (pathname && pathname !== PUBLIC_ROUTE && account !== undefined && !account) {
    return null;
  }

  if (pathname === PUBLIC_ROUTE) {
    return <>{children}</>;
  }

  if (isFullPage) {
    return <>{children}</>;
  }

  return (
    <>
      <AmbientBackground />
      <AppBar />
      <div className="flex flex-1 overflow-hidden z-10 relative min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-base)] relative scroll-smooth min-h-0">
          {children}
        </main>
      </div>
    </>
  );
}
