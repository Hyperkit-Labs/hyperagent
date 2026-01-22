import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";

/**
 * NODE SPECIFICATION: ValidateNode
 * NEVER deviate from this spec.
 */
export const validateNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState" as any,
    output: "HyperAgentState" as any,
    maxRetries: 1,
    timeoutMs: 10000,
    nextNode: "deploy", // Default, engine will override based on validation result
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    // TODO: Validate contract schema, bytecode size, etc.
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

