/**
 * Default values aligned with infra/registries/network/chains.yaml and orchestrator
 * get_anchor_network_slug() / get_default_chain_id().
 * Production builds: SKALE Base Mainnet. Dev/staging/local: SKALE Base Sepolia.
 * Prefer GET /api/v1/config (default_network_id, default_chain_id) when available.
 */

/** True for Vercel production or explicit NEXT_PUBLIC_ENV=production */
function isProductionLike(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const e = process.env;
  return (
    e.NEXT_PUBLIC_ENV === "production" ||
    e.NEXT_PUBLIC_ENV === "prod" ||
    e.VERCEL_ENV === "production"
  );
}

const PROD_NETWORK_ID = "skalebase-mainnet";
const PROD_CHAIN_ID = 1187947933;
const PROD_CHAIN_LABEL = "SKALE Base";

const DEV_NETWORK_ID = "skalebase-sepolia";
const DEV_CHAIN_ID = 324705682;
const DEV_CHAIN_LABEL = "SKALE Base Sepolia";

export const FALLBACK_DEFAULT_NETWORK_ID = isProductionLike()
  ? PROD_NETWORK_ID
  : DEV_NETWORK_ID;
export const FALLBACK_DEFAULT_CHAIN_ID = isProductionLike()
  ? PROD_CHAIN_ID
  : DEV_CHAIN_ID;
export const FALLBACK_DEFAULT_CHAIN_LABEL = isProductionLike()
  ? PROD_CHAIN_LABEL
  : DEV_CHAIN_LABEL;

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

/** Default network for workflow creation: prefer mainnet in production-like builds, else first testnet. */
export function getDefaultNetworkIdFromList(
  networks: Array<{ id: string; is_mainnet?: boolean }>,
): string {
  const wantMainnet = isProductionLike();
  const picked = wantMainnet
    ? networks.find((n) => n.is_mainnet === true)
    : networks.find((n) => n.is_mainnet === false);
  return picked?.id ?? (wantMainnet ? PROD_NETWORK_ID : DEV_NETWORK_ID);
}

/** Default chain ID from list using the same prod/dev rule as getDefaultNetworkIdFromList. */
export function getDefaultChainIdFromList(
  networks: Array<{ chain_id?: number; is_mainnet?: boolean }>,
): number {
  const wantMainnet = isProductionLike();
  const picked = wantMainnet
    ? networks.find((n) => n.is_mainnet === true)
    : networks.find((n) => n.is_mainnet === false);
  return picked?.chain_id ?? (wantMainnet ? PROD_CHAIN_ID : DEV_CHAIN_ID);
}
