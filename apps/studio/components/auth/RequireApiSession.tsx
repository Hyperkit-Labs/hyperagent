"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { ROUTES } from "@/constants/routes";
import { Loader2 } from "lucide-react";

interface RequireApiSessionProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * If no session, redirect to /login. Middleware handles most cases; this is a fallback.
 */
export function RequireApiSession({ children }: RequireApiSessionProps) {
  const { hasSession, isReady } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isReady || hasSession) return;
    const next = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : '';
    router.replace(next ? `${ROUTES.LOGIN}?next=${next}` : ROUTES.LOGIN);
  }, [isReady, hasSession, router]);

  if (!isReady || !hasSession) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[var(--color-text-muted)] animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

