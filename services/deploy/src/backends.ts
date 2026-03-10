/**
 * Deploy plan backend: hybrid chain registry (capabilities first, chains.yaml fallback).
 * thirdweb supplies chain metadata; HyperAgent capabilities supply policy. No duplicate RPC/explorer.
 */
import type { DeployPlanRequest, DeployPlanResult } from "@hyperagent/core-types";
import { DeployToolkit, loadHybridChainRegistry } from "@hyperagent/web3-utils";

export type { DeployPlanRequest, DeployPlanResult };

export interface DeployBackend {
  getPlan(request: DeployPlanRequest): Promise<DeployPlanResult>;
}

export function createDefaultBackend(): DeployBackend {
  const toolkit = new DeployToolkit({
    registryLoader: loadHybridChainRegistry,
    rpcFallback: {},
    explorerFallback: {},
    getEnvRpc: (chainId: number) => process.env[`RPC_URL_${chainId}`],
  });
  return {
    getPlan: (request: DeployPlanRequest) => toolkit.getDeployPlan(request),
  };
}
