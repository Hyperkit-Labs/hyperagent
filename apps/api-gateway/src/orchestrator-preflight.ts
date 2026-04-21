/**
 * Best-effort check after listen: wrong ORCHESTRATOR_URL often yields TLS OK but 0 response bytes on proxied routes.
 */
import { log } from "./logger.js";

export async function logOrchestratorPreflight(
  orchestratorUrl: string,
  timeoutMs: number,
): Promise<void> {
  const base = orchestratorUrl.replace(/\/$/, "");
  const url = `${base}/health/live`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(Math.max(1000, timeoutMs)),
    });
    if (!res.ok) {
      log.warn(
        { url, status: res.status },
        "orchestrator preflight: /health/live returned non-OK",
      );
      return;
    }
    log.info({ orchestrator: base }, "orchestrator preflight ok");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error(
      {
        url,
        err: msg,
        hint:
          "Set ORCHESTRATOR_URL to a base URL the gateway container can reach (e.g. https://orchestrator.example.com or http://orchestrator:8000 on the same Docker network).",
      },
      "orchestrator preflight failed — GET /api/v1/* may hang or return 502",
    );
  }
}
