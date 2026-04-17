/**
 * Settings API: config, llm-keys.
 */

import {
  FALLBACK_DEFAULT_NETWORK_ID,
  FALLBACK_DEFAULT_CHAIN_ID,
} from "@/constants/defaults";
import {
  fetchJson,
  fetchJsonAuthed,
  reportApiError,
  BYOK_REQUEST_TIMEOUT_MS,
} from "./core";

export const workspaceHeaders = (
  workspaceId?: string,
): Record<string, string> =>
  workspaceId ? { "X-Workspace-Id": workspaceId } : {};

export interface IntegrationsStatus {
  tenderly_configured?: boolean;
  pinata_configured?: boolean;
  pinata_dedicated_gateway?: boolean;
  qdrant_configured?: boolean;
  filecoin_configured?: boolean;
  kite_chain_configured?: boolean;
}

export interface RuntimeConfig {
  x402_enabled: boolean;
  monitoring_enabled?: boolean;
  merchant_wallet_address?: string | null;
  credits_enabled?: boolean;
  credits_per_usd?: number;
  credits_per_run?: number;
  integrations?: IntegrationsStatus;
  default_network_id?: string;
  default_chain_id?: number;
  a2a_agent_id?: string | null;
  a2a_default_chain_id?: number | null;
  a2a_identity?: Record<string, unknown> | null;
}

export async function getConfig(): Promise<RuntimeConfig> {
  return fetchJson<RuntimeConfig>("/config").catch((e) => {
    reportApiError(e, { path: "/config" });
    return {
      x402_enabled: false,
      monitoring_enabled: false,
      merchant_wallet_address: null,
      credits_enabled: false,
      integrations: {
        tenderly_configured: false,
        pinata_configured: false,
        qdrant_configured: false,
      },
      default_network_id: FALLBACK_DEFAULT_NETWORK_ID,
      default_chain_id: FALLBACK_DEFAULT_CHAIN_ID,
    };
  });
}

export async function fetchConfigStrict(): Promise<RuntimeConfig> {
  return fetchJson<RuntimeConfig>("/config");
}

export async function getConfiguredLLMProviders(
  workspaceId?: string,
): Promise<{ configured_providers: string[] }> {
  return fetchJsonAuthed("/workspaces/current/llm-keys", {
    credentials: "include",
    headers: workspaceHeaders(workspaceId),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

export async function requireLLMKeys(
  workspaceId?: string,
): Promise<{ ok: boolean }> {
  try {
    const { configured_providers } =
      await getConfiguredLLMProviders(workspaceId);
    return {
      ok:
        Array.isArray(configured_providers) && configured_providers.length > 0,
    };
  } catch {
    return { ok: false };
  }
}

export async function setLLMKeys(
  keys: Record<string, string>,
  workspaceId?: string,
): Promise<{ configured_providers: string[] }> {
  return fetchJsonAuthed("/workspaces/current/llm-keys", {
    method: "POST",
    headers: workspaceHeaders(workspaceId),
    body: JSON.stringify({ keys }),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

export async function deleteLLMKeys(
  workspaceId?: string,
): Promise<{ success: boolean }> {
  return fetchJsonAuthed("/workspaces/current/llm-keys", {
    method: "DELETE",
    headers: workspaceHeaders(workspaceId),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

export async function validateLLMKey(
  provider: string,
  apiKey?: string,
  workspaceId?: string,
): Promise<{ valid: boolean; latency_ms?: number; error?: string }> {
  return fetchJsonAuthed("/workspaces/current/llm-keys/validate", {
    method: "POST",
    headers: workspaceHeaders(workspaceId),
    body: JSON.stringify({ provider, api_key: apiKey || undefined }),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

export const LLM_KEYS_REQUIRED_MESSAGE =
  "Add LLM API keys in Settings to run the pipeline.";

export const BYOK_SAVE_AGAIN_HINT =
  "Enter your keys and click Save again to complete.";

export function isByokStorageOrMigrationError(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("byok storage") ||
    lower.includes("re-save llm keys") ||
    lower.includes("migrate to kms") ||
    lower.includes("llm_key_encryption_key") ||
    lower.includes("llm_key_kms")
  );
}

export const BYOK_RATE_LIMIT_MESSAGE =
  "LLM keys save rate limit reached. Wait a minute and try again.";
