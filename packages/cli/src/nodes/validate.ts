import { HyperAgentState } from "../types/agent";

export async function validateNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [ValidateNode] Verifying audit results against policy...");

    const { auditResults } = state;

    // Specification Lock: Ensure no CRITICAL findings
    // This node decides the path: Success -> Deploy, Failure -> Generate (Retry) or Fail

    if (!auditResults.passed) {
        console.log("  ❌ [ValidateNode] Validation Failed.");
        return {
            status: "failed", // OR loop back to generate in V2
            logs: [...state.logs, "ValidateNode: Validation failed. Stopping execution."]
        };
    }

    console.log("  ✅ [ValidateNode] Validation Passed. Proceeding to deployment.");
    return {
        status: "deploying", // Ready for deployment
        logs: [...state.logs, "ValidateNode: Validation passed."]
    };
}
