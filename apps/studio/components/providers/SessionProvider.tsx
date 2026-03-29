'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
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

/** Opt-in auth-bootstrap debug: `sessionStorage.setItem('DEBUG_SESSION_PROVIDER','1')` then reload. */
function logAuth(...args: unknown[]) {
  if (typeof window !== 'undefined' && sessionStorage.getItem('DEBUG_SESSION_PROVIDER') === '1') {
    console.log('[SessionProvider]', ...args);
  }
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
  const bootstrapInFlight = useRef(false);
  /** After 401/503 config failure, block re-bootstrap until a new session is stored (prevents clear → SESSION_CHANGE → retry loops). */
  const bootstrapFailed = useRef(false);

  const runBootstrap = useCallback(async () => {
    if (!isProtectedPath(pathname ?? '')) {
      setBootstrapStatus('success');
      return;
    }
    if (bootstrapInFlight.current) {
      logAuth('fetchConfigStrict skipped (already in flight)');
      return;
    }
    try {
      bootstrapInFlight.current = true;
      setBootstrapStatus('pending');
      logAuth('fetchConfigStrict start pathname=', pathname);
      await fetchConfigStrict();
      logAuth('fetchConfigStrict success');
      setBootstrapStatus('success');
    } catch (err) {
      const status = (err as ApiErrorWithStatus)?.status;
      logAuth('fetchConfigStrict failed status=', status, 'err=', (err as Error)?.message);
      if (status === 401 || status === 503) {
        bootstrapFailed.current = true;
        clearStoredSession();
        setBootstrapStatus('failed');
        logAuth('redirectToLoginWithNext (401/503) pathname=', pathname, 'window.pathname=', typeof window !== 'undefined' ? window.location.pathname : 'ssr');
        redirectToLoginWithNext();
        return;
      }
      setBootstrapStatus('failed');
    } finally {
      bootstrapInFlight.current = false;
    }
  }, [pathname]);

  const recheckBootstrap = useCallback(async () => {
    bootstrapAttempted.current = false;
    bootstrapFailed.current = false;
    await runBootstrap();
  }, [runBootstrap]);

  useLayoutEffect(() => {
    const session = getStoredSession();
    const nextHasSession = Boolean(session);
    logAuth('initial hasSession=', nextHasSession, 'stored=', session ? 'present' : 'null');
    setHasSession(nextHasSession);
    setIsReady(true);
  }, []);

  useEffect(() => {
    const handler = () => {
      const session = getStoredSession();
      const next = Boolean(session);
      if (next) {
        bootstrapFailed.current = false;
      }
      logAuth('SESSION_CHANGE_EVENT hasSession=', next, '(login completed or cleared)');
      setHasSession(next);
    };
    window.addEventListener(SESSION_CHANGE_EVENT, handler);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const currentPath = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')) || '';
    logAuth('bootstrap effect isReady=true pathname=', pathname, 'currentPath=', currentPath, 'hasSession=', hasSession, 'protected=', isProtectedPath(currentPath));
    if (!isProtectedPath(currentPath)) {
      setBootstrapStatus('success');
      return;
    }
    if (!hasSession) {
      setBootstrapStatus('failed');
      logAuth('redirectToLoginWithNext (!hasSession) pathname=', pathname, 'window.pathname=', typeof window !== 'undefined' ? window.location.pathname : 'ssr');
      redirectToLoginWithNext();
      return;
    }
    if (bootstrapFailed.current) {
      logAuth('bootstrap skipped (bootstrapFailed after auth/config failure)');
      return;
    }
    if (bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void runBootstrap();
  }, [isReady, pathname, hasSession, runBootstrap]);

  const prevHasSession = useRef(false);
  useEffect(() => {
    if (hasSession && !prevHasSession.current) {
      logAuth('hasSession became true (login completed) reset bootstrapAttempted');
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
