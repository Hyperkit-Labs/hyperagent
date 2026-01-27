/**
 * Network configuration for deployment
 * Maps network names to chain IDs and RPC endpoints
 */

import { getChainConfig, SUPPORTED_CHAINS } from "../../core/spec/chains";

export interface DeploymentNetworkConfig {
  network: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  entryPoint: string;
  paymaster: string;
}

/**
 * Get deployment network configuration
 * Uses spec-locked chain configs
 */
export function getDeploymentNetworkConfig(network: string): DeploymentNetworkConfig {
  const chainConfig = getChainConfig(network);
  
  return {
    network: network.toLowerCase(),
    chainId: chainConfig.chainId,
    rpcUrl: chainConfig.rpcUrl,
    explorer: chainConfig.explorer,
    entryPoint: chainConfig.aa_entrypoint,
    paymaster: chainConfig.paymaster,
  };
}

/**
 * Check if network is supported for deployment
 */
export function isNetworkSupported(network: string): boolean {
  try {
    getChainConfig(network);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all supported networks
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(SUPPORTED_CHAINS);
}

