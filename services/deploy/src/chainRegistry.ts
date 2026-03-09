/**
 * Load Chain Registry from YAML (file or URL). Used for RPC and explorer URLs.
 */
const CHAIN_REGISTRY_PATH = process.env.CHAIN_REGISTRY_PATH;
const CHAIN_REGISTRY_URL = process.env.CHAIN_REGISTRY_URL;

interface ChainEntry {
  id: number;
  enabled?: boolean;
  chainlist?: {
    chainId?: number;
    rpcUrls?: string[];
    blockExplorerUrls?: string[];
  };
}

interface RegistrySpec {
  chains?: ChainEntry[];
}

let cached: Map<number, { rpcUrl: string; explorerUrl: string }> | null = null;

async function loadFromUrl(url: string): Promise<RegistrySpec> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chain registry fetch failed: ${res.status}`);
  const text = await res.text();
  const yaml = await import("yaml");
  return yaml.parse(text) as RegistrySpec;
}

async function loadFromPath(path: string): Promise<RegistrySpec> {
  const fs = await import("fs/promises");
  const text = await fs.readFile(path, "utf-8");
  const yaml = await import("yaml");
  return yaml.parse(text) as RegistrySpec;
}

function buildMap(doc: RegistrySpec & { spec?: { chains?: ChainEntry[] } }): Map<number, { rpcUrl: string; explorerUrl: string }> {
  const map = new Map<number, { rpcUrl: string; explorerUrl: string }>();
  const chains = doc?.spec?.chains ?? doc?.chains ?? [];
  for (const c of chains) {
    const id = c.id ?? c.chainlist?.chainId;
    if (id == null || c.enabled === false) continue;
    const rpcUrls = c.chainlist?.rpcUrls;
    const explorerUrls = c.chainlist?.blockExplorerUrls;
    if (rpcUrls?.length) {
      map.set(Number(id), {
        rpcUrl: rpcUrls[0],
        explorerUrl: explorerUrls?.[0] ?? "https://etherscan.io",
      });
    }
  }
  return map;
}

export async function loadChainRegistry(): Promise<Map<number, { rpcUrl: string; explorerUrl: string }>> {
  if (cached) return cached;
  if (CHAIN_REGISTRY_URL) {
    try {
      const spec = await loadFromUrl(CHAIN_REGISTRY_URL);
      cached = buildMap(spec);
      return cached;
    } catch (e) {
      console.warn(`[ChainRegistry] URL fetch failed (${(e as Error).message}), trying local path`);
    }
  }
  if (CHAIN_REGISTRY_PATH) {
    const spec = await loadFromPath(CHAIN_REGISTRY_PATH);
    cached = buildMap(spec);
    return cached;
  }
  cached = new Map();
  return cached;
}

export function getFromRegistry(
  registry: Map<number, { rpcUrl: string; explorerUrl: string }>,
  chainId: number
): { rpcUrl: string; explorerUrl: string } | null {
  return registry.get(chainId) ?? null;
}
