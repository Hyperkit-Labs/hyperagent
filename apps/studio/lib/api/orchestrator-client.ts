/**
 * Typed openapi-fetch client for the orchestrator (same base URL as fetchJson).
 */
import { createOrchestratorClient } from "@hyperagent/api-contracts";

import { getGatewayOrigin } from "./core";

export function getOrchestratorClient() {
  // OpenAPI paths include `/api/v1/...`; base must be origin only (no `/api/v1` suffix).
  return createOrchestratorClient(getGatewayOrigin());
}
