import createClient from "openapi-fetch";

import type { paths } from "./generated/schema.js";

export type OrchestratorPaths = paths;

/**
 * Typed openapi-fetch client for the orchestrator OpenAPI document.
 * Pass the same base URL Studio uses (gateway `/api/v1` prefix included).
 */
export function createOrchestratorClient(
  baseUrl: string,
  init?: RequestInit,
) {
  const root = baseUrl.replace(/\/$/, "");
  return createClient<paths>({ baseUrl: root, ...init });
}
