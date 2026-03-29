'use client';

import { useState, useEffect } from 'react';
import { getApiBase } from '@/lib/api';

/** up = sign-in ready; signin_unavailable = gateway reachable but auth prereqs fail; down = unreachable or unexpected response */
export type ServerStatus = 'up' | 'down' | 'signin_unavailable' | 'loading';

type HealthBody = {
  status?: string;
  auth_signin_ready?: boolean;
};

function interpretHealthResponse(res: Response, data: HealthBody): ServerStatus {
  if (res.ok && res.status === 200) {
    const ready =
      data.auth_signin_ready === true &&
      (data.status === 'ok' || data.status === 'degraded');
    if (ready) return 'up';
    if (data.auth_signin_ready === false) return 'signin_unavailable';
    return 'down';
  }
  if (data.auth_signin_ready === false) return 'signin_unavailable';
  return 'down';
}

/** Gateway /health (no auth). Distinguishes sign-in readiness from total outage. */
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
        const text = await res.text();
        let data: HealthBody = {};
        try {
          data = text ? (JSON.parse(text) as HealthBody) : {};
        } catch {
          data = {};
        }
        setStatus(interpretHealthResponse(res, data));
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
