/**
 * Centralized service URL and feature-flag resolution for Studio.
 * All backend calls use the shared `@hyperagent/config` URL rules so client fetches and Edge CSP stay aligned.
 */

import {
  Env,
  assertValidStudioPublicApiUrlIfPresent,
  parseEnvBool,
  resolveStudioBackendApiV1FromEnv,
} from "@hyperagent/config";

let runtimeFeatures: Record<string, boolean> = {};
let runtimeConfig: Record<string, unknown> = {};

const FALLBACK_FEATURES = {
  x402: false,
} as const;

export function setRuntimeFeatures(features: Record<string, boolean>): void {
  runtimeFeatures = { ...runtimeFeatures, ...features };
}

/** Store config from GET /api/v1/config (default_network_id, default_chain_id, a2a_identity, etc.). */
export function setRuntimeConfig(config: Record<string, unknown>): void {
  runtimeConfig = { ...runtimeConfig, ...config };
}

/** Get a runtime config value (e.g. default_network_id, default_chain_id). */
export function getRuntimeConfig<K = unknown>(key: string): K | undefined {
  return runtimeConfig[key] as K | undefined;
}

function getEnvMap(): Record<string, string | undefined> {
  const base = process.env as Record<string, string | undefined>;
  // Next.js inlines `process.env.NEXT_PUBLIC_*` only where the compiler sees direct
  // member access. Passing the raw `process.env` object into `@hyperagent/config`
  // uses dynamic keys, so the client bundle often had empty NEXT_PUBLIC_API_URL and
  // fell back to http://localhost:4000 (see studio-public-env.getEffectiveNextPublicApiUrl).
  return {
    ...base,
    [Env.NEXT_PUBLIC_API_URL]: process.env.NEXT_PUBLIC_API_URL,
    [Env.NEXT_PUBLIC_ENV]: process.env.NEXT_PUBLIC_ENV,
    [Env.NODE_ENV]: process.env.NODE_ENV,
  };
}

function getAppEnv(): string {
  const envMap = getEnvMap();
  return envMap[Env.NEXT_PUBLIC_ENV] || envMap.NODE_ENV || "development";
}

function getStaticFeatureFlag(featureName: string): boolean | undefined {
  if (featureName === "monitoring") {
    return parseEnvBool(process.env.NEXT_PUBLIC_MONITORING_ENABLED, false);
  }
  return FALLBACK_FEATURES[featureName as keyof typeof FALLBACK_FEATURES];
}

function resolveBackendApiV1(): string {
  const envMap = getEnvMap();
  assertValidStudioPublicApiUrlIfPresent(envMap);
  return resolveStudioBackendApiV1FromEnv(envMap);
}

function toOrchestratorApiV2(backendApiV1: string): string {
  return backendApiV1.replace(/\/api\/v1\/?$/, "/api/v2");
}

function isProductionEnv(env: string): boolean {
  return env === "production" || env === "prod";
}

function isStagingEnv(env: string): boolean {
  return env === "staging" || env === "stage";
}

function warnIfProductionApiIsInsecure(resolved: string): void {
  if (!isProductionEnv(getAppEnv())) {
    return;
  }
  try {
    const parsed = new URL(resolved);
    if (parsed.protocol !== "https:") {
      console.warn(
        `Production API URL should use HTTPS: ${resolved}. Non-HTTPS connections may be blocked by browsers.`,
      );
    }
  } catch {
    // Already validated in resolveBackendApiV1.
  }
}

export function getServiceUrl(serviceName: string): string {
  const env = getAppEnv();

  if (serviceName === "backend") {
    const resolved = resolveBackendApiV1();
    warnIfProductionApiIsInsecure(resolved);
    return resolved;
  }

  if (serviceName === "orchestrator") {
    return toOrchestratorApiV2(resolveBackendApiV1());
  }

  if (isProductionEnv(env) || isStagingEnv(env)) {
    throw new Error(
      `Unknown service "${serviceName}" in ${env}. ` +
        "Supported names are: backend, orchestrator.",
    );
  }

  const fallback = resolveBackendApiV1();
  console.warn(
    `[config] Unknown service: ${serviceName}, dev fallback: ${fallback}`,
  );
  return fallback;
}

export function isFeatureEnabled(featureName: string): boolean {
  return (
    runtimeFeatures[featureName] ?? getStaticFeatureFlag(featureName) ?? false
  );
}

export function getEnv(): string {
  return getAppEnv();
}
