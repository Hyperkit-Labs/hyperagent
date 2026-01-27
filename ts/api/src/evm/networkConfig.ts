import { Env } from "../config/env";

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

const STATIC: Record<StaticNetworkKey, { chainId: number; explorer: string | null }> = {
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

  // Known static network key
  const norm = normalizeNetworkId(raw) as StaticNetworkKey;
  if (Object.prototype.hasOwnProperty.call(STATIC, norm)) {
    return STATIC[norm].chainId;
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

  // If the network key is known, prefer explicit env vars, then RPC_URLS, then Thirdweb.
  if (Object.prototype.hasOwnProperty.call(STATIC, normalized)) {
    const key = normalized as StaticNetworkKey;
    const rpcUrl =
      (key === "avalanche_fuji" && env.RPC_URL_AVALANCHE_FUJI) ||
      (key === "avalanche_mainnet" && env.RPC_URL_AVALANCHE_MAINNET) ||
      (key === "mantle_testnet" && env.RPC_URL_MANTLE_TESTNET) ||
      (key === "mantle_mainnet" && env.RPC_URL_MANTLE_MAINNET) ||
      rpcOverride ||
      buildThirdwebRpcUrl(STATIC[key].chainId, env.THIRDWEB_CLIENT_ID);

    return {
      network: key,
      chainId: STATIC[key].chainId,
      explorer: STATIC[key].explorer,
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
