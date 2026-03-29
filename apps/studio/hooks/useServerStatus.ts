'use client';

import { useState, useEffect } from 'react';
import { getApiBase } from '@/lib/api';

export type ServerStatus = 'up' | 'down' | 'loading';

/** Simple server status from /health (no auth). Used on login page. */
export function useServerStatus(pollIntervalMs = 30_000) {
  const [status, setStatus] = useState<ServerStatus>('loading');

  useEffect(() => {
    const healthUrl = getApiBase().replace(/\/api\/v1\/?$/, '') + '/health';
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const res = await fetch(healthUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        if (!isMounted) return;
        const ok = res.ok && res.status === 200;
        let bodyOk = false;
        if (ok) {
          try {
            const data = (await res.json()) as {
              status?: string;
              /** Gateway /health: aligned with POST /api/v1/auth/bootstrap readiness */
              auth_signin_ready?: boolean;
            };
            /** 200 + auth_signin_ready: sign-in works even when status is degraded (orchestrator down). */
            bodyOk =
              data?.auth_signin_ready === true &&
              (data?.status === 'ok' || data?.status === 'degraded');
          } catch {
            bodyOk = false;
          }
        }
        setStatus(bodyOk ? 'up' : 'down');
      } catch {
        if (isMounted) setStatus('down');
      }
    };

    check();
    intervalId = setInterval(check, pollIntervalMs);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return status;
}
