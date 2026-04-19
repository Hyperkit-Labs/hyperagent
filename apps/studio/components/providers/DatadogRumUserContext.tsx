"use client";

import { useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { onDatadogRumReady } from "@/lib/datadogRumInit";

/**
 * Correlate RUM with the connected wallet (`usr.id` only; pseudonymous, no PII).
 */
export function DatadogRumUserContext() {
  const account = useActiveAccount();

  useEffect(() => {
    return onDatadogRumReady(() => {
      void (async () => {
        try {
          const { datadogRum } = await import("@datadog/browser-rum");
          const address = account?.address;
          if (address) {
            datadogRum.setUser({ id: address });
          } else {
            datadogRum.clearUser();
          }
        } catch {
          /* optional */
        }
      })();
    });
  }, [account?.address]);

  return null;
}
