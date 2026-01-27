import { Env } from "../config/env";
import { getNetwork, getConfigLoader } from "../config/configLoader";

export type NetworkConfig = {
  network: string;
  chainId: number;
  explorer: string | null;
  rpcUrl: string;
};

export type StaticNetworkKey =
  | "avalanche_fuji"
  | "avalanche_mainnet"
  | "mantle_testnet"
  | "mantle_mainnet"
  | "bnb_mainnet"
  | "bnb_testnet"
  | "arbitrum_one"
  | "arbitrum_sepolia"
  | "skale_chaos_testnet"
  | "filecoin_mainnet"
  | "filecoin_calibration";

// Network config is now loaded from config/networks.yaml via config loader
// Legacy hardcoded config kept for fallback during migration
const STATIC_FALLBACK: Record<StaticNetworkKey, { chainId: number; explorer: string | null }> = {
  avalanche_fuji: { chainId: 43113, explorer: "https://testnet.snowtrace.io" },
  avalanche_mainnet: { chainId: 43114, explorer: "https://snowtrace.io" },
  mantle_testnet: { chainId: 5003, explorer: "https://sepolia.mantlescan.xyz" },
  mantle_mainnet: { chainId: 5000, explorer: "https://mantlescan.xyz" },
  bnb_mainnet: { chainId: 56, explorer: "https://bscscan.com" },
  bnb_testnet: { chainId: 97, explorer: "https://testnet.bscscan.com" },
  arbitrum_one: { chainId: 42161, explorer: "https://arbiscan.io" },
  arbitrum_sepolia: { chainId: 421614, explorer: "https://sepolia.arbiscan.io" },
  skale_chaos_testnet: { chainId: 1444673419, explorer: "https://testnet-chaos.explorer.skale.network" },
  filecoin_mainnet: { chainId: 314, explorer: "https://filfox.info/en" },
  filecoin_calibration: { chainId: 314159, explorer: "https://calibration.filfox.info/en" },
};

export function normalizeNetworkId(network: string): string {
  return network.trim().toLowerCase().replace(/-/g, "_");
}

export function parseEvmChainId(input: string): number | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  // CAIP-2: eip155:<chainId>
  const caip = raw.match(/^eip155:(\d+)$/);
  if (caip) {
    const id = Number(caip[1]);
    return Number.isFinite(id) ? id : null;
  }

  // Plain chain id
  const plain = raw.match(/^(\d+)$/);
  if (plain) {
    const id = Number(plain[1]);
    return Number.isFinite(id) ? id : null;
  }

  // Try loading from config/networks.yaml first
  const norm = normalizeNetworkId(raw);
  try {
    const networkConfig = getNetwork(norm);
    if (networkConfig) {
      return networkConfig.chain_id;
    }
  } catch {
    // Fall through to legacy fallback
  }

  // Fallback to legacy static config
  if (Object.prototype.hasOwnProperty.call(STATIC_FALLBACK, norm)) {
    return STATIC_FALLBACK[norm as StaticNetworkKey].chainId;
  }

  return null;
}

function safeParseRpcUrls(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) {
        out[normalizeNetworkId(k)] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function buildThirdwebRpcUrl(chainId: number, clientId?: string): string {
  const suffix = clientId ? `/${clientId}` : "/";
  return `https://${chainId}.rpc.thirdweb.com${suffix}`;
}

export function getNetworkConfig(env: Env, network: string): NetworkConfig {
  const normalized = normalizeNetworkId(network);

  const rpcUrls = safeParseRpcUrls(env.RPC_URLS);
  const rpcOverride = rpcUrls[normalized];

  // Try loading from config/networks.yaml first
  try {
    const yamlConfig = getNetwork(normalized);
    if (yamlConfig) {
      // Prefer: explicit env vars > RPC_URLS > YAML config > Thirdweb
      const rpcUrl =
        (normalized === "avalanche_fuji" && env.RPC_URL_AVALANCHE_FUJI) ||
        (normalized === "avalanche_mainnet" && env.RPC_URL_AVALANCHE_MAINNET) ||
        (normalized === "mantle_testnet" && env.RPC_URL_MANTLE_TESTNET) ||
        (normalized === "mantle_mainnet" && env.RPC_URL_MANTLE_MAINNET) ||
        rpcOverride ||
        yamlConfig.rpc_urls[0] ||
        buildThirdwebRpcUrl(yamlConfig.chain_id, env.THIRDWEB_CLIENT_ID);

      return {
        network: normalized,
        chainId: yamlConfig.chain_id,
        explorer: yamlConfig.explorer || null,
        rpcUrl,
      };
    }
  } catch {
    // Fall through to legacy fallback
  }

  // Legacy fallback: If the network key is known, prefer explicit env vars, then RPC_URLS, then Thirdweb.
  if (Object.prototype.hasOwnProperty.call(STATIC_FALLBACK, normalized)) {
    const key = normalized as StaticNetworkKey;
    const rpcUrl =
      (key === "avalanche_fuji" && env.RPC_URL_AVALANCHE_FUJI) ||
      (key === "avalanche_mainnet" && env.RPC_URL_AVALANCHE_MAINNET) ||
      (key === "mantle_testnet" && env.RPC_URL_MANTLE_TESTNET) ||
      (key === "mantle_mainnet" && env.RPC_URL_MANTLE_MAINNET) ||
      rpcOverride ||
      buildThirdwebRpcUrl(STATIC_FALLBACK[key].chainId, env.THIRDWEB_CLIENT_ID);

    return {
      network: key,
      chainId: STATIC_FALLBACK[key].chainId,
      explorer: STATIC_FALLBACK[key].explorer,
      rpcUrl,
    };
  }

  // Dynamic: allow chainId / CAIP-2 network ids.
  const chainId = parseEvmChainId(network);
  if (chainId !== null) {
    return {
      network: normalized,
      chainId,
      explorer: null,
      rpcUrl: rpcOverride || buildThirdwebRpcUrl(chainId, env.THIRDWEB_CLIENT_ID),
    };
  }

  // Fall back to Thirdweb only if the caller provided something that at least looks like a chain id.
  throw new Error(
    `Unsupported network '${network}'. Provide a known network key (e.g. mantle_testnet) or a chainId/CAIP-2 id (e.g. 56 or eip155:56).`,
  );
}
