/**
 * Resolve network: thirdweb for chain metadata and execution, HyperAgent capabilities for policy.
 * thirdweb owns chain resolution and RPC-facing objects; HyperAgent owns capability policy.
 */
import { defineChain } from "thirdweb/chains";
import type { Chain } from "thirdweb";

export interface ChainCapabilities {
  chainId: number;
  enabled?: boolean;
  tier?: string;
  category?: string;
  rpcUrl?: string;
  explorerUrl?: string;
  nativeCurrency?: { symbol: string; decimals?: number };
  capabilities?: {
    tenderly?: boolean;
    x402?: boolean;
    erc8004?: boolean;
    verification?: string;
    accountAbstraction?: { erc4337?: boolean; eip7702?: boolean };
  };
  aa?: {
    provider?: string;
    factoryMode?: string;
    factoryAddress?: string;
    bundlerUrl?: string;
    entrypointVersion?: string;
  };
  defaults?: {
    framework?: string;
    gasStrategy?: string;
    securityProfile?: string;
  };
}

export interface ResolvedNetwork {
  slug: string;
  chain: Chain;
  chainId: number;
  capabilities: ChainCapabilities["capabilities"];
  aa: ChainCapabilities["aa"];
  defaults: ChainCapabilities["defaults"];
  tier?: string;
  category?: string;
}

export type CapabilitiesMap = Record<string, ChainCapabilities>;

const THIRDWEB_RPC_FALLBACK: Record<number, string> = {
  1: "https://ethereum.publicnode.com",
  8453: "https://mainnet.base.org",
  11155111: "https://rpc.sepolia.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  43113: "https://api.avax-test.network/ext/bc/C/rpc",
  42161: "https://arb1.arbitrum.io/rpc",
  56: "https://bsc-dataseed.bnbchain.org",
  5000: "https://rpc.mantle.xyz",
  324705682: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
};

/**
 * Load capabilities from YAML. Path can be relative to cwd or absolute.
 * Env CAPABILITIES_PATH or CAPABILITIES_URL overrides.
 */
export async function loadCapabilities(): Promise<CapabilitiesMap> {
  const path = process.env.CAPABILITIES_PATH;
  const url = process.env.CAPABILITIES_URL;
  const yaml = await import("yaml");

  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Capabilities fetch failed: ${res.status}`);
    const text = await res.text();
    const doc = yaml.parse(text) as { spec?: { chains?: CapabilitiesMap } };
    return doc?.spec?.chains ?? {};
  }

  if (path) {
    const fs = await import("fs/promises");
    const text = await fs.readFile(path, "utf-8");
    const doc = yaml.parse(text) as { spec?: { chains?: CapabilitiesMap } };
    return doc?.spec?.chains ?? {};
  }

  const registriesPath = process.env.REGISTRIES_PATH;
  if (registriesPath) {
    const fs = await import("fs/promises");
    const { join } = await import("path");
    const defaultPath = join(registriesPath, "network", "capabilities.yaml");
    try {
      const text = await fs.readFile(defaultPath, "utf-8");
      const doc = yaml.parse(text) as { spec?: { chains?: CapabilitiesMap } };
      return doc?.spec?.chains ?? {};
    } catch {
      /* ignore */
    }
  }

  return {};
}

const capabilitiesCache: { map: CapabilitiesMap | null } = { map: null };

/**
 * Get cached capabilities. Call loadCapabilities() first.
 */
export function getCachedCapabilities(): CapabilitiesMap {
  return capabilitiesCache.map ?? {};
}

/**
 * Resolve a network by slug. Uses thirdweb for chain object; overlays HyperAgent capabilities.
 */
export async function resolveNetwork(
  slug: string,
  capabilities?: CapabilitiesMap
): Promise<ResolvedNetwork> {
  const caps = capabilities ?? getCachedCapabilities();
  const cap = caps[slug];

  if (!cap) {
    throw new Error(`Unknown chain slug: ${slug}`);
  }

  if (cap.enabled === false) {
    throw new Error(`Chain ${slug} is not enabled`);
  }

  const chainId = cap.chainId;

  const chain = cap.rpcUrl
    ? defineChain({
        id: chainId,
        rpc: cap.rpcUrl,
        ...(cap.explorerUrl && {
          blockExplorers: [{ name: "Explorer", url: cap.explorerUrl }],
        }),
        ...(cap.nativeCurrency && {
          nativeCurrency: {
            symbol: cap.nativeCurrency.symbol,
            decimals: cap.nativeCurrency.decimals ?? 18,
          },
        }),
      })
    : defineChain(chainId);

  return {
    slug,
    chain,
    chainId,
    capabilities: cap.capabilities,
    aa: cap.aa,
    defaults: cap.defaults,
    tier: cap.tier,
    category: cap.category,
  };
}

/**
 * Resolve by chain ID. Looks up slug from capabilities.
 */
export async function resolveNetworkByChainId(
  chainId: number,
  capabilities?: CapabilitiesMap
): Promise<ResolvedNetwork | null> {
  const caps = capabilities ?? getCachedCapabilities();
  const entry = Object.entries(caps).find(([, c]) => c.chainId === chainId);
  if (!entry) return null;
  return resolveNetwork(entry[0], caps);
}

/**
 * Build chain registry map (chainId -> { rpcUrl, explorerUrl }) from capabilities.
 * Uses thirdweb defineChain for chain metadata when rpcUrl not in capabilities.
 */
export async function buildChainRegistryFromCapabilities(
  capabilities: CapabilitiesMap
): Promise<Map<number, { rpcUrl: string; explorerUrl: string }>> {
  const map = new Map<number, { rpcUrl: string; explorerUrl: string }>();

  for (const [slug, cap] of Object.entries(capabilities)) {
    if (cap.enabled === false) continue;

    const chainId = cap.chainId;
    let rpcUrl = cap.rpcUrl;
    let explorerUrl = cap.explorerUrl;

    if (!rpcUrl) {
      const chain = defineChain(chainId);
      const c = chain as { rpc?: string; blockExplorers?: { url: string }[] };
      if (typeof c.rpc === "string") rpcUrl = c.rpc;
      if (c.blockExplorers?.[0]?.url) explorerUrl = c.blockExplorers[0].url;
      if (!rpcUrl) rpcUrl = THIRDWEB_RPC_FALLBACK[chainId];
    }

    if (rpcUrl) {
      map.set(chainId, {
        rpcUrl,
        explorerUrl: explorerUrl ?? "https://etherscan.io",
      });
    }
  }

  return map;
}

/**
 * Initialize capabilities cache. Call from app startup.
 */
export async function initCapabilities(): Promise<CapabilitiesMap> {
  const map = await loadCapabilities();
  capabilitiesCache.map = map;
  return map;
}

/**
 * Hybrid registry loader: capabilities first (thirdweb + policy), then chains.yaml fallback.
 * Use as RegistryLoader for DeployToolkit.
 */
export async function loadHybridChainRegistry(): Promise<
  Map<number, { rpcUrl: string; explorerUrl: string }>
> {
  const caps = await loadCapabilities();
  if (Object.keys(caps).length > 0) {
    return buildChainRegistryFromCapabilities(caps);
  }
  let path = process.env.CHAIN_REGISTRY_PATH;
  const url = process.env.CHAIN_REGISTRY_URL;
  if (!path && process.env.REGISTRIES_PATH) {
    const { join } = await import("path");
    path = join(process.env.REGISTRIES_PATH, "network", "chains.yaml");
  }
  const yaml = await import("yaml");
  if (url) {
    const res = await fetch(url);
    if (res.ok) {
      const doc = yaml.parse(await res.text()) as {
        spec?: { chains?: Array<{ id?: number; chainlist?: { chainId?: number; rpcUrls?: string[]; blockExplorerUrls?: string[] } }> };
      };
      const map = new Map<number, { rpcUrl: string; explorerUrl: string }>();
      for (const c of doc?.spec?.chains ?? []) {
        const id = c.id ?? c.chainlist?.chainId;
        if (id == null || (c as { enabled?: boolean }).enabled === false) continue;
        const rpc = c.chainlist?.rpcUrls?.[0];
        if (rpc) map.set(Number(id), { rpcUrl: rpc, explorerUrl: c.chainlist?.blockExplorerUrls?.[0] ?? "https://etherscan.io" });
      }
      return map;
    }
  }
  if (path) {
    const fs = await import("fs/promises");
    const doc = yaml.parse(await fs.readFile(path, "utf-8")) as {
      spec?: { chains?: Array<{ id?: number; chainlist?: { chainId?: number; rpcUrls?: string[]; blockExplorerUrls?: string[] } }> };
    };
    const map = new Map<number, { rpcUrl: string; explorerUrl: string }>();
    for (const c of doc?.spec?.chains ?? []) {
      const id = c.id ?? c.chainlist?.chainId;
      if (id == null || (c as { enabled?: boolean }).enabled === false) continue;
      const rpc = c.chainlist?.rpcUrls?.[0];
      if (rpc) map.set(Number(id), { rpcUrl: rpc, explorerUrl: c.chainlist?.blockExplorerUrls?.[0] ?? "https://etherscan.io" });
    }
    return map;
  }
  return new Map();
}
