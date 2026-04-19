import { captureRequestError } from "@sentry/nextjs";
import { assertValidStudioPublicApiUrlIfPresent } from "@hyperagent/config";

function truthyEnv(v: string | undefined): boolean {
  return v === "1" || v === "true";
}

/** Load dd-trace when LLM Observability, APM tracing, or profiling is explicitly enabled. */
function shouldLoadDatadogNodeTracer(): boolean {
  return (
    truthyEnv(process.env.DD_LLMOBS_ENABLED) ||
    truthyEnv(process.env.DD_TRACE_ENABLED) ||
    truthyEnv(process.env.DD_PROFILING_ENABLED)
  );
}

export async function register() {
  assertValidStudioPublicApiUrlIfPresent(
    process.env as Record<string, string | undefined>,
  );
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (shouldLoadDatadogNodeTracer()) {
      try {
        const initializeImportName = "dd-trace/initialize.mjs";
        await import(
          /* webpackIgnore: true */ initializeImportName as "dd-trace/initialize.mjs"
        );
      } catch {
        console.warn(
          "[datadog] dd-trace failed to load; run pnpm install and ensure dd-trace is in the lockfile",
        );
      }
    }
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/** Next.js App Router hook — forwards RSC request errors to Sentry. */
export const onRequestError = captureRequestError;
