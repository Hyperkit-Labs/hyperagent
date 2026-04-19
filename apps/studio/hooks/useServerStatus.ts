"use client";

import { useState, useEffect } from "react";
import { getApiBase } from "@/lib/api";

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

function interpretHealthResponse(
  res: Response,
  data: HealthBody,
): ServerStatus {
  if (!res.ok) {
    if (data.auth_signin_ready === false) return "signin_unavailable";
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

/** Gateway /health (no auth). Distinguishes sign-in readiness from total outage. */
export function useServerStatus(pollIntervalMs = 30_000) {
  const [status, setStatus] = useState<ServerStatus>("loading");

  useEffect(() => {
    const healthUrl = getApiBase().replace(/\/api\/v1\/?$/, "") + "/health";
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const res = await fetch(healthUrl, {
          method: "GET",
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

    check();
    intervalId = setInterval(check, pollIntervalMs);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return status;
}
