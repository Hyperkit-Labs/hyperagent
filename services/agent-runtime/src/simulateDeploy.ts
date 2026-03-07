/**
 * Simulate, deploy, and pin endpoints (merged from simulation/deploy/storage services).
 * Uses @hyperagent/ai-tools and @hyperagent/web3-utils when built from monorepo.
 */

import type { SimulateRequest, SimulateTxResult, DeployPlanRequest, DeployPlanResult, PinRequest, PinResult } from "@hyperagent/core-types";
import { TenderlyToolkit } from "@hyperagent/ai-tools";
import { DeployToolkit, IpfsPinataToolkit } from "@hyperagent/web3-utils";

let tenderly: TenderlyToolkit | null = null;
let deployToolkit: DeployToolkit | null = null;
let ipfsToolkit: IpfsPinataToolkit | null = null;

async function loadChainRegistry(): Promise<Map<number, { rpcUrl: string; explorerUrl: string }>> {
  const path = process.env.CHAIN_REGISTRY_PATH;
  const url = process.env.CHAIN_REGISTRY_URL;
  const map = new Map<number, { rpcUrl: string; explorerUrl: string }>();
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
    const text = await res.text();
    const yaml = await import("yaml");
    const doc = yaml.parse(text) as { spec?: { chains?: Array<{ id?: number; chainlist?: { chainId?: number; rpcUrls?: string[]; blockExplorerUrls?: string[] } }> } };
    const chains = doc?.spec?.chains ?? [];
    for (const c of chains) {
      const id = c.id ?? c.chainlist?.chainId;
      if (id == null) continue;
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
  if (path) {
    const fs = await import("fs/promises");
    const text = await fs.readFile(path, "utf-8");
    const yaml = await import("yaml");
    const doc = yaml.parse(text) as { spec?: { chains?: Array<{ id?: number; chainlist?: { chainId?: number; rpcUrls?: string[]; blockExplorerUrls?: string[] } }> } };
    const chains = doc?.spec?.chains ?? [];
    for (const c of chains) {
      const id = c.id ?? c.chainlist?.chainId;
      if (id == null) continue;
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
  map.set(1, { rpcUrl: "https://ethereum.publicnode.com", explorerUrl: "https://etherscan.io" });
  map.set(8453, { rpcUrl: "https://mainnet.base.org", explorerUrl: "https://basescan.org" });
  map.set(11155111, { rpcUrl: "https://rpc.sepolia.org", explorerUrl: "https://sepolia.etherscan.io" });
  return map;
}

function getTenderly(): TenderlyToolkit | null {
  if (tenderly) return tenderly;
  const key = process.env.TENDERLY_API_KEY;
  if (!key) return null;
  tenderly = new TenderlyToolkit(
    key,
    process.env.TENDERLY_API_URL || "https://api.tenderly.co",
    process.env.TENDERLY_ACCOUNT,
    process.env.TENDERLY_PROJECT
  );
  return tenderly;
}

function getDeployToolkit(): DeployToolkit {
  if (deployToolkit) return deployToolkit;
  deployToolkit = new DeployToolkit({
    registryLoader: loadChainRegistry,
    rpcFallback: { 1: "https://ethereum.publicnode.com", 8453: "https://mainnet.base.org", 11155111: "https://rpc.sepolia.org" },
    explorerFallback: { 1: "https://etherscan.io", 8453: "https://basescan.org", 11155111: "https://sepolia.etherscan.io" },
    getEnvRpc: (chainId: number) => process.env[`RPC_URL_${chainId}`],
  });
  return deployToolkit;
}

export async function simulate(params: SimulateRequest): Promise<SimulateTxResult> {
  const t = getTenderly();
  if (!t) {
    return { success: false, error: "TENDERLY_API_KEY not configured", gasUsed: 0 };
  }
  return t.simulate({
    network: params.network,
    from: params.from,
    to: params.to,
    data: params.data,
    value: params.value ?? "0",
  });
}

export async function getDeployPlan(request: DeployPlanRequest): Promise<DeployPlanResult> {
  return getDeployToolkit().getDeployPlan(request);
}

function getIpfsToolkit(): IpfsPinataToolkit | null {
  if (ipfsToolkit) return ipfsToolkit;
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  ipfsToolkit = new IpfsPinataToolkit(
    jwt,
    process.env.PINATA_API_URL || "https://api.pinata.cloud",
    process.env.PINATA_GATEWAY_BASE || "https://gateway.pinata.cloud/ipfs"
  );
  return ipfsToolkit;
}

export async function pin(params: PinRequest): Promise<PinResult> {
  const t = getIpfsToolkit();
  if (!t) throw new Error("PINATA_JWT not configured");
  return t.pin(params.content, params.name);
}

export async function unpin(cid: string): Promise<void> {
  const t = getIpfsToolkit();
  if (!t) throw new Error("PINATA_JWT not configured");
  return t.unpin(cid);
}
