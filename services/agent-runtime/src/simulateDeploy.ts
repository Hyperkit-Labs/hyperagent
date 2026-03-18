/**
 * Simulate, deploy, and pin via simulation and storage services (single implementation).
 * Consolidates Tenderly/IPFS: all calls go through services, not direct toolkits.
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
import { DeployToolkit, loadHybridChainRegistry } from "@hyperagent/web3-utils";

const SIMULATION_URL = (process.env.SIMULATION_SERVICE_URL || "http://localhost:8002").replace(/\/$/, "");
const STORAGE_URL = (process.env.STORAGE_SERVICE_URL || "http://localhost:4005").replace(/\/$/, "");

let deployToolkit: DeployToolkit | null = null;

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
  const res = await fetch(`${SIMULATION_URL}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      network: params.network,
      from: params.from,
      to: params.to,
      data: params.data,
      value: params.value ?? "0",
    }),
  });
  const data = (await res.json()) as SimulateTxResult & { error?: string };
  if (!res.ok) {
    return { success: false, error: data.error ?? "Simulation failed", gasUsed: 0 };
  }
  return data;
}

export async function simulateBundle(params: SimulateBundleRequest): Promise<SimulateBundleResult> {
  const res = await fetch(`${SIMULATION_URL}/simulate-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ simulations: params.simulations }),
  });
  const data = (await res.json()) as SimulateBundleResult & { error?: string };
  if (!res.ok) {
    return { success: false, error: data.error ?? "Bundle simulation failed", gasUsed: 0 };
  }
  return data;
}

export async function getDeployPlan(request: DeployPlanRequest): Promise<DeployPlanResult> {
  return getDeployToolkit().getDeployPlan(request);
}

export async function pin(params: PinRequest): Promise<PinResult> {
  const res = await fetch(`${STORAGE_URL}/ipfs/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: params.content, name: params.name }),
  });
  const data = (await res.json()) as { success?: boolean; cid?: string; gatewayUrl?: string; error?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Pin failed");
  }
  return { cid: data.cid ?? "", gatewayUrl: data.gatewayUrl ?? "" };
}

export async function unpin(cid: string): Promise<void> {
  const res = await fetch(`${STORAGE_URL}/ipfs/unpin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid }),
  });
  if (!res.ok) {
    throw new Error("Unpin failed");
  }
}
