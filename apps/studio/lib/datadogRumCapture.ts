/**
 * Client-side helpers to enrich Datadog RUM Error Tracking beyond automatic capture.
 */

export async function addDatadogRumError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { datadogRum } = await import("@datadog/browser-rum");
    const err = error instanceof Error ? error : new Error(String(error));
    datadogRum.addError(err, context);
  } catch {
    /* RUM not configured or SDK unavailable */
  }
}

/** Custom timing / funnel steps (shown in RUM Explorer). */
export async function addDatadogRumAction(
  name: string,
  context?: Record<string, unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { datadogRum } = await import("@datadog/browser-rum");
    datadogRum.addAction(name, context);
  } catch {
    /* optional */
  }
}
