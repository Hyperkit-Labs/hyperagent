/**
 * RUM session id for correlating browser sessions with Datadog LLM Observability (server traces).
 * @see https://docs.datadoghq.com/real_user_monitoring/correlate_with_other_telemetry/llm_observability/
 */
export async function getDatadogRumSessionIdForRequest(): Promise<
  string | undefined
> {
  if (typeof window === "undefined") return undefined;
  try {
    const { datadogRum } = await import("@datadog/browser-rum");
    const id = datadogRum.getInternalContext()?.session_id;
    return typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}
