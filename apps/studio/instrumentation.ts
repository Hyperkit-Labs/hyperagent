import { captureRequestError } from "@sentry/nextjs";
import { assertValidStudioPublicApiUrlIfPresent } from "@hyperagent/config";

export async function register() {
  assertValidStudioPublicApiUrlIfPresent(
    process.env as Record<string, string | undefined>,
  );
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Next.js App Router hook — forwards RSC request errors to Sentry. */
export const onRequestError = captureRequestError;
