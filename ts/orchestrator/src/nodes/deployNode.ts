import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { DEPLOYMENT_STEPS } from "../core/spec/chains";

/**
 * NODE SPECIFICATION: DeployNode
 * NEVER deviate from this spec.
 */
export const deployNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState" as any,
    output: "HyperAgentState" as any,
    maxRetries: 3,
    timeoutMs: 120000,
    nextNode: "eigenda",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    // TODO: Execute DEPLOYMENT_STEPS in sequence
    // TODO: Use thirdweb SDK for deployment
    const baseUrl = process.env.PYTHON_BACKEND_URL || "";
    const network = state.meta.chains.selected;

    if (!baseUrl) {
      return withUpdates(state, {
        status: "failed",
        logs: [...state.logs, "[DEPLOY] Missing PYTHON_BACKEND_URL for deployment"],
      });
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/deployments/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          compiled_contract: { source: state.contract },
          network,
          use_gasless: true,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return withUpdates(state, {
          status: "failed",
          logs: [...state.logs, `[DEPLOY] Python deployment failed: ${response.status} ${text}`],
        });
      }

      const data = (await response.json()) as {
        contract_address: string;
        transaction_hash: string;
      };

      return withUpdates(state, {
        deploymentAddress: data.contract_address,
        txHash: data.transaction_hash,
        status: "deploying",
        logs: [
          ...state.logs,
          `[DEPLOY] Executing ${DEPLOYMENT_STEPS.length} deployment steps`,
          "[DEPLOY] Contract deployed via Python backend",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withUpdates(state, {
        status: "failed",
        logs: [...state.logs, `[DEPLOY] Deployment error: ${message}`],
      });
    }
  },
};

