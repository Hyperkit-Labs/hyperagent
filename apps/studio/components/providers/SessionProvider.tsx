"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  getStoredSession,
  SESSION_CHANGE_EVENT,
} from "@/lib/session-store";
import { ROUTES } from "@/constants/routes";
import { redirectToLoginWithNext } from "@/lib/authRedirect";

export type BootstrapStatus = "pending" | "success" | "failed";

export interface SessionContextValue {
  hasSession: boolean;
  bootstrapStatus: BootstrapStatus;
  isReady: boolean;
  /** Reserved for route-level gating errors; local data loaders own fetch errors. */
  bootstrapError: string | null;
  recheckBootstrap: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within SessionProvider");
  }
  return ctx;
}

const PROTECTED_PATHS: (string | ((p: string) => boolean))[] = [
  ROUTES.HOME,
  ROUTES.DASHBOARD,
  ROUTES.WORKFLOWS,
  ROUTES.WORKFLOW_CREATE,
  ROUTES.PAYMENTS,
  ROUTES.SETTINGS,
  ROUTES.AGENTS,
  ROUTES.DEPLOYMENTS,
  ROUTES.CONTRACTS,
  ROUTES.TEMPLATES,
  ROUTES.MARKETPLACE,
  ROUTES.ANALYTICS,
  ROUTES.NETWORKS,
  ROUTES.MONITORING,
  ROUTES.SECURITY,
  ROUTES.APPS,
  ROUTES.HISTORY,
  ROUTES.DOMAINS,
  ROUTES.DOCS,
  (p) => p.startsWith("/workflows/"),
  (p) => p.startsWith("/apps/"),
];

function isProtectedPath(pathname: string): boolean {
  if (pathname === ROUTES.LOGIN) return false;
  return PROTECTED_PATHS.some((p) =>
    typeof p === "function" ? p(pathname) : pathname === p,
  );
}

function logAuth(...args: unknown[]) {
  if (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    sessionStorage.getItem("DEBUG_SESSION_PROVIDER") === "1"
  ) {
    console.log("[SessionProvider]", ...args);
  }
}

/**
 * Single owner of session presence + route gating.
 * Protected routes require a stored session, but do not block on `/api/v1/config`.
 * Individual providers/cards own their own fetch lifecycle and error UI.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] =
    useState<BootstrapStatus>("pending");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const redirectingRef = useRef(false);

  const safeRedirectToLogin = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    redirectToLoginWithNext();
  }, []);

  const runBootstrap = useCallback(async () => {
    const path = pathname ?? "";
    if (!isProtectedPath(path)) {
      setBootstrapStatus("success");
      setBootstrapError(null);
      return;
    }

    const session = getStoredSession();
    if (!session?.access_token) {
      setBootstrapStatus("failed");
      setBootstrapError(null);
      safeRedirectToLogin();
      return;
    }
    setBootstrapStatus("success");
    setBootstrapError(null);
    redirectingRef.current = false;
    logAuth("bootstrap gate passed pathname=", path);
  }, [pathname, safeRedirectToLogin]);

  const recheckBootstrap = useCallback(async () => {
    redirectingRef.current = false;
    setBootstrapError(null);
    await runBootstrap();
  }, [runBootstrap]);

  useLayoutEffect(() => {
    const session = getStoredSession();
    setHasSession(Boolean(session));
    setIsReady(true);
    logAuth("initial hasSession=", Boolean(session));
  }, []);

  useEffect(() => {
    const handler = () => {
      const session = getStoredSession();
      const next = Boolean(session);
      setHasSession(next);
      if (next) {
        redirectingRef.current = false;
        setBootstrapError(null);
      }
      logAuth("SESSION_CHANGE_EVENT hasSession=", next);
    };
    window.addEventListener(SESSION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const path =
      (pathname ??
        (typeof window !== "undefined" ? window.location.pathname : "")) ||
      "";
    logAuth("route effect pathname=", path, "hasSession=", hasSession);

    if (!isProtectedPath(path)) {
      setBootstrapStatus("success");
      setBootstrapError(null);
      return;
    }

    if (!hasSession) {
      setBootstrapStatus("failed");
      setBootstrapError(null);
      safeRedirectToLogin();
      return;
    }

    void runBootstrap();
  }, [isReady, pathname, hasSession, runBootstrap, safeRedirectToLogin]);

  const value: SessionContextValue = {
    hasSession,
    bootstrapStatus,
    isReady,
    bootstrapError,
    recheckBootstrap,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
