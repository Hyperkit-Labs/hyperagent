/**
 * Typed openapi-fetch client for the orchestrator (same base URL as fetchJson).
 */
import { createOrchestratorClient } from "@hyperagent/api-contracts";

import { getApiBase } from "./core";

export function getOrchestratorClient() {
  return createOrchestratorClient(getApiBase());
}
