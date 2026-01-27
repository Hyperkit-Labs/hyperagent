import { HyperAgentState } from "../types/agent";

export async function validateNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    console.log("  → [ValidateNode] Verifying audit results against policy...");

    const { auditResults } = state;

    // Specification Lock: Ensure no CRITICAL findings
    // This node decides the path: Success -> Deploy, Failure -> Generate (Retry) or Fail

    if (!auditResults.passed) {
        const nextRetryCount = (state.retryCount || 0) + 1;
        const { MAX_RETRIES } = await import("../types/agent");

        if (nextRetryCount > MAX_RETRIES) {
            console.log("  ❌ [ValidateNode] Max retries exceeded. Halting.");
            return {
                status: "failed",
                logs: [...state.logs, `ValidateNode: Max retries (${MAX_RETRIES}) exceeded. Self-repair failed.`]
            };
        }

        console.log(`  ❌ [ValidateNode] Validation Failed. Initiating self-repair loop (Attempt ${nextRetryCount}/${MAX_RETRIES})...`);
        return {
            status: "validating",
            retryCount: nextRetryCount,
            logs: [...state.logs, `ValidateNode: Validation failed. Retrying generation (Attempt ${nextRetryCount}/${MAX_RETRIES}).`]
        };
    }

    console.log("  ✅ [ValidateNode] Validation Passed. Proceeding to deployment.");
    return {
        status: "deploying", // Ready for deployment
        logs: [...state.logs, "ValidateNode: Validation passed."]
    };
}
