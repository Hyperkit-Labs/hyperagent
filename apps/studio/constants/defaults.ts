/**
 * Default values from chain registry (GitOps single source).
 * Default is first testnet from GET /api/v1/networks or this fallback. Sepolia is the default network.
 */

/** Fallback default network when API list is not loaded (must match a testnet slug in chain registry). */
export const FALLBACK_DEFAULT_NETWORK_ID = "skalebase-sepolia";

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
