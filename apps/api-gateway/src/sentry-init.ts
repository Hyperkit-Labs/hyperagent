/**
 * Optional Sentry for the API gateway. Call initSentry() after load-env; no-op when DSN is unset.
 */
import * as Sentry from "@sentry/node";
import { getGatewayEnv } from "@hyperagent/config";

export function initSentry(): void {
  const { sentry, nodeEnv } = getGatewayEnv();
  const dsn = sentry.dsn?.trim();
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: sentry.environment ?? nodeEnv ?? "development",
    tracesSampleRate: sentry.tracesSampleRate,
  });
}

export { Sentry };
