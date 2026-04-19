/**
 * Links Datadog RUM (browser session_id) to the active APM/LLM Observability span when dd-trace is loaded.
 */
export async function tagActiveRootSpanWithRumSession(
  rumSessionId: string | undefined,
): Promise<void> {
  if (!rumSessionId || rumSessionId.length > 256) return;
  try {
    const tracer = (await import("dd-trace")).default;
    const span = tracer.scope().active();
    if (span) {
      span.setTag("session_id", rumSessionId);
    }
  } catch {
    /* dd-trace optional (local dev or image without agent) */
  }
}
