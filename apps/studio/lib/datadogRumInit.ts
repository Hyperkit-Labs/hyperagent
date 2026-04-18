import { datadogRum } from "@datadog/browser-rum";

const INIT_FLAG = "__hyperagent_dd_rum_init__";

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}

function tracingMatchers(): Array<
  string | { match: string | RegExp; propagatorTypes: ["datadog"] }
> {
  const out: Array<
    string | { match: string | RegExp; propagatorTypes: ["datadog"] }
  > = [
    { match: /^https?:\/\/localhost:4000/, propagatorTypes: ["datadog"] },
    { match: /^https?:\/\/127\.0\.0\.1:4000/, propagatorTypes: ["datadog"] },
  ];
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!api) return out;
  try {
    const u = new URL(api.startsWith("http") ? api : `https://${api}`);
    out.push({ match: u.origin, propagatorTypes: ["datadog"] });
  } catch {
    /* ignore */
  }
  return out;
}

/** Idempotent; no-op when RUM env is unset (local dev without Datadog). */
export function initDatadogBrowserRum(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, boolean>;
  if (w[INIT_FLAG]) return;

  const applicationId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID?.trim();
  const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN?.trim();
  if (!applicationId || !clientToken) return;

  w[INIT_FLAG] = true;

  const site = process.env.NEXT_PUBLIC_DD_SITE?.trim() || "us5.datadoghq.com";
  const service =
    process.env.NEXT_PUBLIC_DD_SERVICE_NAME?.trim() || "hyperagent-studio";
  const env =
    process.env.NEXT_PUBLIC_DD_ENV?.trim() ||
    process.env.NEXT_PUBLIC_ENV?.trim() ||
    "development";
  const version =
    process.env.NEXT_PUBLIC_DD_VERSION?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    "";

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service,
    env,
    ...(version ? { version } : {}),
    sessionSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_DD_SESSION_SAMPLE_RATE,
      100,
    ),
    sessionReplaySampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_DD_SESSION_REPLAY_SAMPLE_RATE,
      20,
    ),
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
    allowedTracingUrls: tracingMatchers(),
  });
}
