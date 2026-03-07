/**
 * Deploy plan backend: chain config from registry only (CHAIN_REGISTRY_PATH / CHAIN_REGISTRY_URL).
 * No duplicate RPC/explorer in code or env; one loader, one cache. Add chain to registry to support it.
 */
import type { DeployPlanRequest, DeployPlanResult } from "@hyperagent/core-types";
import { DeployToolkit } from "@hyperagent/web3-utils";
import { loadChainRegistry } from "./chainRegistry.js";

export type { DeployPlanRequest, DeployPlanResult };

export interface DeployBackend {
  getPlan(request: DeployPlanRequest): Promise<DeployPlanResult>;
}

export function createDefaultBackend(): DeployBackend {
  const toolkit = new DeployToolkit({
    registryLoader: loadChainRegistry,
    rpcFallback: {},
    explorerFallback: {},
    getEnvRpc: (chainId: number) => process.env[`RPC_URL_${chainId}`],
  });
  return {
    getPlan: (request: DeployPlanRequest) => toolkit.getDeployPlan(request),
  };
}
