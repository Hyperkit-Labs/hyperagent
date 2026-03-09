/**
 * Default values from chain registry (GitOps single source).
 * Must match infra/registries/network/chains.yaml anchor (skalebase-sepolia).
 * Prefer GET /api/v1/config (default_network_id, default_chain_id) when available.
 */

export const FALLBACK_DEFAULT_NETWORK_ID = "skalebase-sepolia";
export const FALLBACK_DEFAULT_CHAIN_ID = 324705682;
export const FALLBACK_DEFAULT_CHAIN_LABEL = "SKALE Base Sepolia";

/**
 * Polling and timeout constants. Tune in one place for all data hooks.
 * Deployments/contracts are derived from workflows; use same interval as workflows when possible.
 */
export const POLLING = {
  WORKFLOWS_MS: 30_000,
  METRICS_MS: 30_000,
  DEPLOYMENTS_MS: 45_000,
  CONTRACTS_MS: 60_000,
  NETWORKS_MS: 120_000,
  AGENTS_MS: 30_000,
  LOGS_MS: 30_000,
  HEALTH_MS: 30_000,
  DATA_FETCH_MS: 30_000,
  WORKFLOW_POLL_MS: 5_000,
  WORKFLOW_POLL_TIMEOUT_MS: 5 * 60 * 1000,
  WORKFLOW_STATUS_UNCHANGED_LIMIT: 10,
} as const;

/** Request timeout for fetch (e.g. health, config). */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Default network for workflow creation: use first testnet from list, else fallback. */
export function getDefaultNetworkIdFromList(
  networks: Array<{ id: string; is_mainnet?: boolean }>
): string {
  const testnet = networks.find((n) => n.is_mainnet === false);
  return testnet?.id ?? FALLBACK_DEFAULT_NETWORK_ID;
}

/** Default chain ID: use first testnet from list, else fallback. */
export function getDefaultChainIdFromList(
  networks: Array<{ chain_id?: number; is_mainnet?: boolean }>
): number {
  const testnet = networks.find((n) => n.is_mainnet === false);
  return testnet?.chain_id ?? FALLBACK_DEFAULT_CHAIN_ID;
}
