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
            const data = await res.json();
            bodyOk = data?.status === 'ok';
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
