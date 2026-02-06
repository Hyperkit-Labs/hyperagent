/**
 * Helper functions for deployNode
 * Extracted to improve Single Responsibility Principle
 */

import { HyperAgentState } from "../core/spec/state";
import { DeploymentOptions } from "../adapters/deployment/thirdwebDeployer";

/**
 * Validate deployment prerequisites
 */
export function validateDeploymentPrerequisites(
  state: HyperAgentState,
  privateKey: string | undefined,
): { valid: boolean; error?: string } {
  if (!state.contract || state.contract.trim().length === 0) {
    return { valid: false, error: "No contract code found" };
  }

  if (!privateKey) {
    return { valid: false, error: "DEPLOYER_PRIVATE_KEY not set" };
  }

  const bytecode = (state.meta as any)?.compiled?.bytecode;
  if (!bytecode || bytecode.length === 0) {
    return { valid: false, error: "No bytecode found in state.meta.compiled" };
  }

  return { valid: true };
}

/**
 * Build deployment options from state
 */
export function buildDeploymentOptions(
  state: HyperAgentState,
  network: string,
): DeploymentOptions {
  const bytecode = (state.meta as any)?.compiled?.bytecode || "";
  const abi = (state.meta as any)?.compiled?.abi || [];
  const constructorArgs = (state.meta as any)?.constructorArgs || [];

  return {
    bytecode,
    abi,
    constructorArgs,
    network,
  };
}

/**
 * Extract network from state
 */
export function extractNetwork(state: HyperAgentState, defaultNetwork: string): string {
  return state.meta?.chains?.selected || defaultNetwork;
}

