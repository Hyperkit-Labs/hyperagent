'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { getStoredSession, clearStoredSession, SESSION_CHANGE_EVENT } from '@/lib/session-store';
import { fetchConfigStrict } from '@/lib/api';
import type { ApiErrorWithStatus } from '@/lib/api';
import { ROUTES } from '@/constants/routes';
import { redirectToLoginWithNext } from '@/lib/authRedirect';

export type BootstrapStatus = 'pending' | 'success' | 'failed';

export interface SessionContextValue {
  /** True when a valid session exists (JWT in store). */
  hasSession: boolean;
  /** Bootstrap: pending | success | failed. Failed = 401/503 from config; redirect to login. */
  bootstrapStatus: BootstrapStatus;
  /** True after first client mount (avoids hydration mismatch). */
  isReady: boolean;
  /** Manually trigger bootstrap re-check (e.g. after sign-in). */
  recheckBootstrap: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  hasSession: false,
  bootstrapStatus: 'pending',
  isReady: false,
  recheckBootstrap: async () => {},
});

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSessionContext must be used within SessionProvider');
  }
  return ctx;
}

/** Routes that require session. All others (e.g. /login) skip bootstrap. */
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
  (p) => p.startsWith('/workflows/'),
  (p) => p.startsWith('/apps/'),
];

function isProtectedPath(pathname: string): boolean {
  if (pathname === ROUTES.LOGIN) return false;
  return PROTECTED_PATHS.some((p) =>
    typeof p === 'function' ? p(pathname) : pathname === p
  );
}

/**
 * SessionProvider: single authority for session state and bootstrap status.
 * On bootstrap failure (401/503 from GET /config): redirect to /login, block protected content.
 * Prevents ghost state where wallet is connected but backend is unreachable or session invalid.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>('pending');
  const [isReady, setIsReady] = useState(false);
  const bootstrapAttempted = useRef(false);

  const runBootstrap = useCallback(async () => {
    if (!isProtectedPath(pathname ?? '')) {
      setBootstrapStatus('success');
      return;
    }
    try {
      setBootstrapStatus('pending');
      await fetchConfigStrict();
      setBootstrapStatus('success');
    } catch (err) {
      const status = (err as ApiErrorWithStatus)?.status;
      if (status === 401 || status === 503) {
        clearStoredSession();
        setBootstrapStatus('failed');
        redirectToLoginWithNext();
        return;
      }
      setBootstrapStatus('success');
    }
  }, [pathname]);

  const recheckBootstrap = useCallback(async () => {
    bootstrapAttempted.current = false;
    await runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    queueMicrotask(() => {
      setHasSession(Boolean(getStoredSession()));
      setIsReady(true);
    });
  }, []);

  useEffect(() => {
    const handler = () => setHasSession(Boolean(getStoredSession()));
    window.addEventListener(SESSION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!isReady || pathname === undefined) return;
    if (!isProtectedPath(pathname)) {
      setBootstrapStatus('success');
      return;
    }
    if (!hasSession) {
      setBootstrapStatus('failed');
      return;
    }
    if (bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void runBootstrap();
  }, [isReady, pathname, hasSession, runBootstrap]);

  const prevHasSession = useRef(false);
  useEffect(() => {
    if (hasSession && !prevHasSession.current) {
      bootstrapAttempted.current = false;
    }
    prevHasSession.current = hasSession;
  }, [hasSession]);

  const value: SessionContextValue = {
    hasSession,
    bootstrapStatus,
    isReady,
    recheckBootstrap,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
