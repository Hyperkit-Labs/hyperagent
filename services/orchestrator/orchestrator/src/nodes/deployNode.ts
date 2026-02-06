import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { DEPLOYMENT_STEPS } from "../core/spec/chains";
import { executeDeployment, DeploymentOptions } from "../adapters/deployment/thirdwebDeployer";
import { needsCompilation } from "../adapters/deployment/compileAdapter";
import { config } from "../config/env";
import { NODE_TIMEOUTS, NODE_RETRIES, DEPLOYMENT_CONFIG } from "../core/constants";
import {
  validateDeploymentPrerequisites,
  buildDeploymentOptions,
  extractNetwork,
} from "./deployNode.helpers";

/**
 * NODE SPECIFICATION: DeployNode
 * NEVER deviate from this spec.
 * 
 * Implements DEPLOYMENT_STEPS:
 * 1. Validate bytecode
 * 2. Create smart account
 * 3. Deploy with account
 * 4. Verify on-chain
 */
export const deployNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.DEPLOY,
    timeoutMs: NODE_TIMEOUTS.DEPLOY,
    nextNode: "eigenda",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const logs = [...state.logs];
    logs.push(`[DEPLOY] Executing ${DEPLOYMENT_STEPS.length} deployment steps`);

    // Check if contract exists
    if (!state.contract || state.contract.trim().length === 0) {
      logs.push("[DEPLOY] Error: No contract code found");
      return withUpdates(state, {
        status: "failed",
        logs,
      });
    }

    // Check if contract needs compilation
    // For now, we expect bytecode to be available in meta or pre-compiled
    // If source code is provided, compilation should happen in a previous step
    if (needsCompilation(state.contract)) {
      logs.push("[DEPLOY] Warning: Contract appears to be source code, not bytecode");
      logs.push("[DEPLOY] Compilation should happen before deployment. Checking meta for bytecode...");
      
      // Check if bytecode is in meta (if compilation happened elsewhere)
      const bytecodeFromMeta = (state.meta as any)?.compiled?.bytecode;
      if (!bytecodeFromMeta) {
        logs.push("[DEPLOY] Error: Source code provided but no bytecode found in meta");
        return withUpdates(state, {
          status: "failed",
          logs: [
            ...logs,
            "[DEPLOY] Deployment requires compiled bytecode. Add compilation step before deploy.",
          ],
        });
      }
      
      // Use bytecode from meta
      state.contract = bytecodeFromMeta;
      logs.push("[DEPLOY] Using bytecode from meta");
    }

    // Get network from state
    const network = state.meta?.chains?.selected || DEPLOYMENT_CONFIG.DEFAULT_NETWORK;
    logs.push(`[DEPLOY] Target network: ${network}`);

    // Get deployment options
    // Note: Private key should come from environment or user wallet
    // For now, we'll require it to be set via environment variable
    const privateKey = config.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      logs.push("[DEPLOY] Error: DEPLOYER_PRIVATE_KEY not set");
      return withUpdates(state, {
        status: "failed",
        logs: [
          ...logs,
          "[DEPLOY] Deployment requires DEPLOYER_PRIVATE_KEY environment variable",
        ],
      });
    }

    try {
      // Execute deployment following DEPLOYMENT_STEPS
      const deploymentOptions: DeploymentOptions = {
        network,
        bytecode: state.contract,
        abi: (state.meta as any)?.compiled?.abi || [],
        constructorArgs: (state.meta as any)?.constructorArgs || [],
        privateKey,
      };

      logs.push("[DEPLOY] Starting deployment execution...");
      const result = await executeDeployment(deploymentOptions);

      logs.push(`[DEPLOY] ✓ Deployment successful`);
      logs.push(`[DEPLOY] Contract address: ${result.contractAddress}`);
      logs.push(`[DEPLOY] Transaction hash: ${result.txHash}`);

      return withUpdates(state, {
        status: "deploying",
        deploymentAddress: result.contractAddress,
        txHash: result.txHash,
        logs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`[DEPLOY] Error: ${message}`);

      // Check if error indicates we should revert to generate node
      if (message.includes("Bytecode validation failed") || message.includes("too large")) {
        logs.push("[DEPLOY] Validation failed, should revert to generate node");
        // Note: The engine will handle routing based on validation failure
      }

      return withUpdates(state, {
        status: "failed",
        logs,
      });
    }
  },
};

