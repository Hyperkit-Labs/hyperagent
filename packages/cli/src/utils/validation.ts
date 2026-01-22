import { HyperAgentState, NodeType, VALID_TRANSITIONS } from "../types/agent";

export function verifyNodeOutput(
    output: HyperAgentState,
    expectedNode: NodeType
): { valid: boolean; errors: string[] } {

    const errors: string[] = [];

    // Check 1: All required fields present
    const requiredFields = ["intent", "contract", "auditResults", "deploymentAddress", "txHash", "status", "logs"];
    requiredFields.forEach(field => {
        if (!(field in output)) {
            errors.push(`Missing field: ${field}`);
        }
    });

    // Check 2: Status is valid
    const validStatuses = ["processing", "auditing", "validating", "deploying", "success", "failed"];
    if (!validStatuses.includes(output.status)) {
        errors.push(`Invalid status: ${output.status}`);
    }

    // Check 3: No extra fields (dictionary spec only)
    // Note: output might have other internal properties if passed from class, but as a plain object it should match.
    // We'll trust the Type system partially, but runtime check is good.
    const allowedFields = new Set(requiredFields);
    Object.keys(output).forEach(key => {
        if (!allowedFields.has(key)) {
            errors.push(`Unexpected field: ${key}`);
        }
    });

    // Check 4: Edge routing is valid (Manual check, though graph handles it)
    // This is more about next step, but here we just validate state integrity.

    return {
        valid: errors.length === 0,
        errors
    };
}
