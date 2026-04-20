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
  clearStoredSession,
  SESSION_CHANGE_EVENT,
} from "@/lib/session-store";
import { fetchConfigStrict } from "@/lib/api";
import type { ApiErrorWithStatus } from "@/lib/api";
import { ROUTES } from "@/constants/routes";
import { redirectToLoginWithNext } from "@/lib/authRedirect";
import {
  bootstrapConfigFailureMessage,
  getErrorRequestId,
} from "@/lib/sadPathCopy";

export type BootstrapStatus = "pending" | "success" | "failed";

export interface SessionContextValue {
  hasSession: boolean;
  bootstrapStatus: BootstrapStatus;
  isReady: boolean;
  /** User-safe message when bootstrap failed without invalidating the JWT (e.g. 503/429). */
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
 * Single owner of session + authenticated bootstrap (GET /api/v1/config).
 * Clears session and redirects only on 401/403. 503/429 stay logged-in with bootstrapError + retry.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] =
    useState<BootstrapStatus>("pending");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const bootstrapInFlight = useRef(false);
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

    if (bootstrapInFlight.current) {
      logAuth("runBootstrap skipped (in flight)");
      return;
    }

    bootstrapInFlight.current = true;
    setBootstrapStatus("pending");
    setBootstrapError(null);
    logAuth("fetchConfigStrict start pathname=", path);

    try {
      await fetchConfigStrict();
      setBootstrapStatus("success");
      setBootstrapError(null);
      redirectingRef.current = false;
      logAuth("fetchConfigStrict success");
    } catch (err) {
      const status = (err as ApiErrorWithStatus)?.status;
      const code = (err as ApiErrorWithStatus & { code?: string })?.code;
      logAuth(
        "fetchConfigStrict failed status=",
        status,
        "code=",
        code,
        "err=",
        (err as Error)?.message,
      );
      setBootstrapStatus("failed");

      if (status === 401 || status === 403) {
        clearStoredSession();
        setBootstrapError(null);
        safeRedirectToLogin();
        return;
      }

      const requestId = getErrorRequestId(err);
      const rawMessage =
        err instanceof Error && err.message
          ? err.message
          : "Could not verify your session with the server.";
      setBootstrapError(
        bootstrapConfigFailureMessage(status, code, rawMessage, requestId),
      );
    } finally {
      bootstrapInFlight.current = false;
    }
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
