const INIT_FLAG = "__hyperagent_dd_rum_init__";
const INIT_STARTED = "__hyperagent_dd_rum_started__";
const SKIPPED_FLAG = "__hyperagent_dd_rum_skipped__";

type RumReadyListener = () => void;
const rumReadyListeners = new Set<RumReadyListener>();

/** Run after RUM `init` succeeds (or immediately if already initialized). */
export function onDatadogRumReady(cb: RumReadyListener): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as Record<string, boolean>;
  if (w[SKIPPED_FLAG]) return () => {};
  if (w[INIT_FLAG]) {
    queueMicrotask(cb);
    return () => {};
  }
  rumReadyListeners.add(cb);
  return () => {
    rumReadyListeners.delete(cb);
  };
}

function flushRumReadyListeners(): void {
  for (const cb of rumReadyListeners) {
    try {
      cb();
    } catch {
      /* listener errors should not break RUM */
    }
  }
  rumReadyListeners.clear();
}

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}

function isLocalhostHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
}

function allowRumOnLocalhost(): boolean {
  return (
    process.env.NEXT_PUBLIC_DD_RUM_ON_LOCALHOST === "1" ||
    process.env.NEXT_PUBLIC_DD_RUM_ON_LOCALHOST === "true"
  );
}

/** RUM `env` must not tag local dev as prod when .env copies production NEXT_PUBLIC_DD_ENV. */
function resolveRumEnv(): string {
  if (
    typeof window !== "undefined" &&
    isLocalhostHostname(window.location.hostname)
  ) {
    return "dev";
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev";
  }
  return (
    process.env.NEXT_PUBLIC_DD_ENV?.trim() ||
    process.env.NEXT_PUBLIC_ENV?.trim() ||
    "prod"
  );
}

function allowRumInDevelopment(): boolean {
  return (
    process.env.NEXT_PUBLIC_DD_RUM_IN_DEV === "1" ||
    process.env.NEXT_PUBLIC_DD_RUM_IN_DEV === "true"
  );
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
  if (typeof window !== "undefined" && window.location?.origin) {
    out.push({
      match: window.location.origin,
      propagatorTypes: ["datadog"],
    });
  }
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

/** Idempotent; no-op when RUM env is unset. Loads SDK in a separate chunk when configured. */
export function initDatadogBrowserRum(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, boolean>;
  if (w[SKIPPED_FLAG] || w[INIT_FLAG] || w[INIT_STARTED]) return;

  if (
    process.env.NODE_ENV === "production" &&
    isLocalhostHostname(window.location.hostname) &&
    !allowRumOnLocalhost()
  ) {
    w[SKIPPED_FLAG] = true;
    rumReadyListeners.clear();
    if (process.env.NEXT_PUBLIC_DD_RUM_DEBUG === "1") {
      console.warn(
        "[Datadog RUM] skipped on localhost for production build (set NEXT_PUBLIC_DD_RUM_ON_LOCALHOST=1 to send)",
      );
    }
    return;
  }

  if (process.env.NODE_ENV !== "production" && !allowRumInDevelopment()) {
    w[SKIPPED_FLAG] = true;
    rumReadyListeners.clear();
    if (process.env.NEXT_PUBLIC_DD_RUM_DEBUG === "1") {
      console.warn(
        "[Datadog RUM] skipped in development (set NEXT_PUBLIC_DD_RUM_IN_DEV=1 to enable)",
      );
    }
    return;
  }

  const applicationId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID?.trim();
  const clientToken = process.env.NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN?.trim();
  if (!applicationId || !clientToken) {
    w[SKIPPED_FLAG] = true;
    rumReadyListeners.clear();
    if (process.env.NEXT_PUBLIC_DD_RUM_DEBUG === "1") {
      console.warn(
        "[Datadog RUM] skipped: NEXT_PUBLIC_DD_RUM_APPLICATION_ID or NEXT_PUBLIC_DD_RUM_CLIENT_TOKEN empty at build time",
      );
    }
    return;
  }

  w[INIT_STARTED] = true;

  const site = process.env.NEXT_PUBLIC_DD_SITE?.trim() || "us5.datadoghq.com";
  const service =
    process.env.NEXT_PUBLIC_DD_SERVICE_NAME?.trim() || "hyperagent-studio";
  const env = resolveRumEnv();
  const version =
    process.env.NEXT_PUBLIC_DD_VERSION?.trim() ||
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    "";

  void import("@datadog/browser-rum")
    .then(({ datadogRum }) => {
      try {
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
        w[INIT_FLAG] = true;
        flushRumReadyListeners();
        if (process.env.NEXT_PUBLIC_DD_RUM_DEBUG === "1") {
          console.info("[Datadog RUM] initialized", { site, service, env });
        }
      } catch (e) {
        console.error("[Datadog RUM] init failed", e);
        rumReadyListeners.clear();
      }
    })
    .catch((e) => {
      console.error("[Datadog RUM] load failed", e);
      rumReadyListeners.clear();
    });
}
