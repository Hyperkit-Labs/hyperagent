'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getConfig } from '@/lib/api';
import { setRuntimeFeatures } from '@/config/environment';
import { ROUTES } from '@/constants/routes';

/**
 * Fetches GET /api/v1/config (registry-based) and updates runtime feature flags.
 * Skips fetch on /login so we do not call the API before the user has signed in (avoids "Failed to fetch" when gateway is down).
 */
export function ConfigLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === ROUTES.LOGIN) {
      setRuntimeFeatures({ x402: false, monitoring: false });
      return;
    }
    getConfig()
      .then((config) => {
        setRuntimeFeatures({
          x402: config.x402_enabled,
          monitoring: config.monitoring_enabled ?? false,
        });
      })
      .catch(() => {
        setRuntimeFeatures({ x402: false, monitoring: false });
      });
  }, [pathname]);
  return null;
}
