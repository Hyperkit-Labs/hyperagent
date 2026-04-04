export interface PlatformTrackRecord {
  audits_completed: number;
  vulnerabilities_found: number;
  security_researchers: number;
  contracts_deployed: number;
  source: string;
}

function toNonNegativeInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function getTrackRecordFallback(): PlatformTrackRecord {
  return {
    audits_completed: toNonNegativeInt(process.env.PLATFORM_AUDITS_COMPLETED),
    vulnerabilities_found: toNonNegativeInt(process.env.PLATFORM_VULNERABILITIES_FOUND),
    security_researchers: toNonNegativeInt(process.env.PLATFORM_SECURITY_RESEARCHERS),
    contracts_deployed: toNonNegativeInt(process.env.PLATFORM_CONTRACTS_DEPLOYED),
    source: "gateway_env_fallback",
  };
}

function hasValidShape(data: unknown): data is PlatformTrackRecord {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.audits_completed === "number" &&
    typeof obj.vulnerabilities_found === "number" &&
    typeof obj.security_researchers === "number" &&
    typeof obj.contracts_deployed === "number" &&
    typeof obj.source === "string"
  );
}

export async function fetchTrackRecordWithFallback(
  orchestratorUrl: string,
  timeoutMs: number,
  requestId?: string
): Promise<PlatformTrackRecord> {
  const fallback = getTrackRecordFallback();
  const base = orchestratorUrl.replace(/\/$/, "");
  const url = `${base}/api/v1/platform/track-record`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (requestId) headers["x-request-id"] = requestId;

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) return fallback;

    const data = (await res.json()) as unknown;
    if (!hasValidShape(data)) return fallback;
    return data;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
