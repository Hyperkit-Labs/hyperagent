/**
 * DeployToolkit: builds deploy plans from chain registry data. Single place for chain/RPC and deploy plan logic.
 * Use from services/deploy; load chain config from same registry path (CHAIN_REGISTRY_PATH or CHAIN_REGISTRY_URL).
 */
import type { DeployPlanRequest, DeployPlanResult } from "@hyperagent/core-types";

export type ChainRegistryEntry = { rpcUrl: string; explorerUrl: string };
export type ChainRegistryMap = Map<number, ChainRegistryEntry>;

export type RegistryLoader = () => Promise<ChainRegistryMap>;

const DEFAULT_RPC_FALLBACK: Record<number, string> = {
  1: "https://ethereum.publicnode.com",
  8453: "https://mainnet.base.org",
  11155111: "https://rpc.sepolia.org",
};
const DEFAULT_EXPLORER_FALLBACK: Record<number, string> = {
  1: "https://etherscan.io",
  8453: "https://basescan.org",
  11155111: "https://sepolia.etherscan.io",
};

export interface DeployToolkitOptions {
  registryLoader: RegistryLoader;
  rpcFallback?: Record<number, string>;
  explorerFallback?: Record<number, string>;
  getEnvRpc?: (chainId: number) => string | undefined;
}

export class DeployToolkit {
  private registry: ChainRegistryMap | null = null;
  private readonly loader: RegistryLoader;
  private readonly rpcFallback: Record<number, string>;
  private readonly explorerFallback: Record<number, string>;
  private readonly getEnvRpc?: (chainId: number) => string | undefined;

  constructor(options: DeployToolkitOptions) {
    this.loader = options.registryLoader;
    const nodeEnv = process.env.NODE_ENV || "development";
    const useDefaults = nodeEnv !== "production";
    this.rpcFallback = options.rpcFallback ?? (useDefaults ? DEFAULT_RPC_FALLBACK : {});
    this.explorerFallback = options.explorerFallback ?? (useDefaults ? DEFAULT_EXPLORER_FALLBACK : {});
    this.getEnvRpc = options.getEnvRpc;
  }

  async getDeployPlan(request: DeployPlanRequest): Promise<DeployPlanResult> {
    const { chainId, bytecode, abi, constructorArgs = [], contractName } = request;
    if (!this.registry) {
      this.registry = await this.loader();
    }
    const fromReg = this.registry.get(chainId) ?? null;
    const rpcUrl =
      fromReg?.rpcUrl ?? this.getEnvRpc?.(chainId) ?? this.rpcFallback[chainId];
    const explorerUrl = fromReg?.explorerUrl ?? this.explorerFallback[chainId];
    if (!rpcUrl) {
      throw new Error(
        `Chain ${chainId} not in registry. Add to infra/registries/network/chains.yaml or set CHAIN_REGISTRY_PATH/CHAIN_REGISTRY_URL and RPC_URL_${chainId}.`
      );
    }
    return {
      deployFromConnectedAccount: true,
      chainId,
      rpcUrl,
      explorerUrl: explorerUrl ?? "",
      bytecode,
      abi,
      constructorArgs,
      contractName,
    };
  }
}
