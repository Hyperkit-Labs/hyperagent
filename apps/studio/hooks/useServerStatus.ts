"use client";

import { useState, useEffect } from "react";

/** up = sign-in ready; degraded = gateway alive, orchestrator or deps unhealthy; signin_unavailable = gateway reachable but auth prereqs fail; down = unreachable */
export type ServerStatus =
  | "up"
  | "down"
  | "degraded"
  | "signin_unavailable"
  | "loading";

type HealthBody = {
  status?: string;
  auth_signin_ready?: boolean;
  orchestrator_ok?: boolean;
  orchestrator_reachable?: boolean;
  pipeline_ready?: boolean;
  message?: string;
};

export function interpretHealthResponse(
  res: Response,
  data: HealthBody,
): ServerStatus {
  if (!res.ok) {
    if (data.auth_signin_ready === false) return "signin_unavailable";
    if (data.status === "degraded" && data.auth_signin_ready === true) {
      return "degraded";
    }
    return "down";
  }

  if (data.auth_signin_ready === false) return "signin_unavailable";

  if (data.status === "ok" && data.auth_signin_ready === true) return "up";

  if (data.status === "degraded") {
    if (data.auth_signin_ready === true) return "degraded";
    return "signin_unavailable";
  }

  if (data.auth_signin_ready === true) return "up";
  return "degraded";
}

/** Default poll for gateway /health/signin (ms). Slower than 30s to avoid noise on the login view. */
const DEFAULT_SERVER_STATUS_POLL_MS = 90_000;

/**
 * Login health check timeout. Slightly above the gateway proxy upstream budget so the
 * browser waits for the Next.js same-origin route (see /api/gateway-health/signin) rather
 * than aborting while a cross-origin preflight hangs.
 */
const HEALTH_FETCH_TIMEOUT_MS = 12_000;

/** Gateway /health/signin (no auth). Distinguishes sign-in readiness from total outage without deep orchestrator checks. */
export function useServerStatus(
  pollIntervalMs = DEFAULT_SERVER_STATUS_POLL_MS,
) {
  const [status, setStatus] = useState<ServerStatus>("loading");

  useEffect(() => {
    /** Same-origin proxy avoids CORS on direct gateway fetches from the login page. */
    const healthUrl = "/api/gateway-health/signin";
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cancelDeferred: (() => void) | undefined;

    const check = async () => {
      try {
        const res = await fetch(healthUrl, {
          method: "GET",
          signal: AbortSignal.timeout(HEALTH_FETCH_TIMEOUT_MS),
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
      } catch (err) {
        if (
          process.env.NODE_ENV === "development" &&
          typeof console !== "undefined"
        ) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            "[useServerStatus] health check failed",
            { healthUrl, message: msg },
            "If the URL is localhost:4000 but you use a remote API, set NEXT_PUBLIC_ENV=staging (or production) during next dev, or run a local gateway. If Studio is on port 3001+, ensure CORS_ORIGINS on the gateway includes that origin.",
          );
        }
        if (isMounted) setStatus("down");
      }
    };

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        void check();
      }, pollIntervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        startInterval();
      } else if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const kick = () => {
      void check();
      startInterval();
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(
        () => {
          if (!isMounted) return;
          kick();
        },
        { timeout: 2000 },
      );
      cancelDeferred = () => cancelIdleCallback(id);
    } else {
      const t = setTimeout(() => {
        if (!isMounted) return;
        kick();
      }, 0);
      cancelDeferred = () => clearTimeout(t);
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isMounted = false;
      cancelDeferred?.();
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollIntervalMs]);

  return status;
}
