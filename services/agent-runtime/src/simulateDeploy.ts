/**
 * Simulate, deploy, and pin endpoints (merged from simulation/deploy/storage services).
 * Uses @hyperagent/ai-tools and @hyperagent/web3-utils when built from monorepo.
 * Hybrid chain registry: capabilities first, chains.yaml fallback.
 */

import type {
  SimulateRequest,
  SimulateTxResult,
  SimulateBundleRequest,
  SimulateBundleResult,
  DeployPlanRequest,
  DeployPlanResult,
  PinRequest,
  PinResult,
} from "@hyperagent/core-types";
import { TenderlyToolkit } from "@hyperagent/ai-tools";
import { DeployToolkit, IpfsPinataToolkit, loadHybridChainRegistry } from "@hyperagent/web3-utils";

let tenderly: TenderlyToolkit | null = null;
let deployToolkit: DeployToolkit | null = null;
let ipfsToolkit: IpfsPinataToolkit | null = null;

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
    registryLoader: loadHybridChainRegistry,
    rpcFallback: {},
    explorerFallback: {},
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

export async function simulateBundle(params: SimulateBundleRequest): Promise<SimulateBundleResult> {
  const t = getTenderly();
  if (!t) {
    return { success: false, error: "TENDERLY_API_KEY not configured", gasUsed: 0 };
  }
  return t.simulateBundle(params);
}

export async function getDeployPlan(request: DeployPlanRequest): Promise<DeployPlanResult> {
  return getDeployToolkit().getDeployPlan(request);
}

function getIpfsToolkit(): IpfsPinataToolkit | null {
  if (ipfsToolkit) return ipfsToolkit;
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  const gatewayBase = process.env.PINATA_GATEWAY_BASE?.trim();
  const gatewayDomain = process.env.PINATA_GATEWAY_DOMAIN?.trim();
  ipfsToolkit = new IpfsPinataToolkit(jwt, {
    baseUrl: process.env.PINATA_API_URL || "https://api.pinata.cloud",
    gatewayBase: gatewayBase || undefined,
    gatewayDomain: gatewayDomain || "gateway.pinata.cloud",
  });
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
