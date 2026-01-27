import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { NODE_TIMEOUTS, NODE_RETRIES } from "../core/constants";

/**
 * NODE SPECIFICATION: ValidateNode
 * NEVER deviate from this spec.
 */
export const validateNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.VALIDATE,
    timeoutMs: NODE_TIMEOUTS.VALIDATE,
    nextNode: "deploy", // Default, engine will override based on validation result
  },
      async execute(state: HyperAgentState): Promise<HyperAgentState> {
        // Validate contract schema, bytecode size, and forbidden opcodes
        const isValid =
          state.contract.length > 0 &&
          state.auditResults.passed &&
          !containsForbiddenOpcodes(state.contract);

    if (!isValid) {
      // Engine will route back to generate based on validation result
      return withUpdates(state, {
        status: "processing",
        logs: [...state.logs, "[VALIDATE] Validation failed, routing to generate"],
      });
    }

    // Engine will route to deploy if validation passes
    return withUpdates(state, {
      status: "validating",
      logs: [...state.logs, "[VALIDATE] ✓ Validation passed, proceeding to deploy"],
    });
  },
};

function containsForbiddenOpcodes(contract: string): boolean {
  const lowered = contract.toLowerCase();
  return lowered.includes("selfdestruct") || lowered.includes("delegatecall");
}

