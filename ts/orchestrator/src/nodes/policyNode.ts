import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation, NodeType } from "../core/spec/nodes";

/**
 * NODE SPECIFICATION: PolicyNode
 * NEVER deviate from this spec.
 */

// Validation function
function validatePolicyInput(state: HyperAgentState): boolean {
  const checks = [
    state.intent.length > 0,
    state.intent.length < 500,
    /^[a-zA-Z0-9\s:,.\-()]*$/.test(state.intent), // ASCII only
  ];
  return checks.every((c) => c === true);
}

export const policyNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState" as any,
    output: "HyperAgentState" as any,
    maxRetries: 1,
    timeoutMs: 5000,
    nextNode: "generate",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    // Step 1: Validate input
    if (!validatePolicyInput(state)) {
      return withUpdates(state, {
        status: "failed",
        logs: [...state.logs, "[POLICY] Invalid intent"],
      });
    }

    // Step 2: Check compliance rules
    const rules = [
      {
        rule: "no_selfdestruct",
        check: () => !state.intent.toLowerCase().includes("selfdestruct"),
      },
      {
        rule: "no_delegatecall",
        check: () => !state.intent.toLowerCase().includes("delegatecall"),
      },
    ];

    const violations = rules.filter((r) => !r.check());
    if (violations.length > 0) {
      return withUpdates(state, {
        status: "failed",
        logs: [
          ...state.logs,
          `[POLICY] Violations: ${violations.map((v) => v.rule).join(", ")}`,
        ],
      });
    }

    // Step 3: Update state and log
    return withUpdates(state, {
      status: "processing",
      logs: [...state.logs, "[POLICY] ✓ Intent valid, proceeding to generation"],
    });
  },
};

