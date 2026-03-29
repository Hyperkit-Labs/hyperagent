/**
 * Service discovery: env-driven URLs. In production, no localhost default; fail fast when missing.
 */

export type ServiceName =
  | "orchestrator"
  | "agent_runtime"
  | "compile"
  | "audit"
  | "simulation"
  | "deploy"
  | "storage"
  | "vectordb";

const DEFAULTS: Record<ServiceName, string> = {
  orchestrator: "http://localhost:8000",
  agent_runtime: "http://localhost:4001",
  compile: "http://localhost:8004",
  audit: "http://localhost:8001",
  simulation: "http://localhost:8002",
  deploy: "http://localhost:8003",
  storage: "http://localhost:4005",
  vectordb: "http://localhost:8010",
};

const ENV_KEYS: Record<ServiceName, string> = {
  orchestrator: "ORCHESTRATOR_URL",
  agent_runtime: "AGENT_RUNTIME_URL",
  compile: "COMPILE_SERVICE_URL",
  audit: "AUDIT_SERVICE_URL",
  simulation: "SIMULATION_SERVICE_URL",
  deploy: "DEPLOY_SERVICE_URL",
  storage: "STORAGE_SERVICE_URL",
  vectordb: "VECTORDB_URL",
};

const isProduction = process.env.NODE_ENV === "production" || process.env.ENV === "production";

export function getServiceUrl(service: ServiceName): string {
  const key = ENV_KEYS[service];
  const val = (process.env[key] || "").trim().replace(/\/$/, "");
  if (val) return val;
  if (isProduction) {
    throw new Error(`Production requires ${key} for service ${service}`);
  }
  return DEFAULTS[service];
}

export function createRedisClient(role: "queue" | "cache" | "limiter"): unknown | null {
  const url = (process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "").trim();
  if (!url) return null;
  try {
    const Redis = require("ioredis");
    return new Redis(url, { keyPrefix: `${role}:` });
  } catch {
    return null;
  }
}
