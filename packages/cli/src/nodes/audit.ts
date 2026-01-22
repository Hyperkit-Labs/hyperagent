import { HyperAgentState } from "../types/agent";
import { APPROVED_MODELS } from "../config/models";

// Mock audit tool wrapper
export class SlitherAdapter {
    static async runAudit(contractCode: string): Promise<{ passed: boolean; findings: string[] }> {
        console.log("  🔍 [AuditNode] Running Slither (and semantic checks)...");

        // MVP: Regex based basic checks to simulate "Audit"
        const findings: string[] = [];

        // Check 1: SPMX License Identifier
        if (!contractCode.includes("SPDX-License-Identifier")) {
            findings.push("CRITICAL: Missing SPDX-License-Identifier");
        }

        // Check 2: Solidity Version
        if (!contractCode.includes("pragma solidity")) {
            findings.push("CRITICAL: Missing pragma solidity version");
        }

        // Check 3: Constructor
        if (!contractCode.includes("constructor")) {
            findings.push("WARNING: Contract missing constructor (might be intended)");
        }

        return {
            passed: findings.filter(f => f.startsWith("CRITICAL")).length === 0,
            findings
        };
    }
}

export async function auditNode(state: HyperAgentState): Promise<Partial<HyperAgentState>> {
    const { contract } = state;

    if (!contract) {
        return {
            status: "failed",
            logs: [...state.logs, "AuditNode: No contract code found to audit."]
        };
    }

    const auditResult = await SlitherAdapter.runAudit(contract);

    const logs = [...state.logs];
    logs.push(`AuditNode: Found ${auditResult.findings.length} issues.`);
    auditResult.findings.forEach(f => logs.push(`  - ${f}`));

    if (!auditResult.passed) {
        return {
            status: "failed",
            auditResults: auditResult,
            logs: [...logs, "AuditNode: Critical issues found. Halting."]
        };
    }

    return {
        // status: "deploying", // Wait! Logic says Audit -> Validate.
        // But for MVP flow, Audit Node output goes to Validate Node.
        // Let's assume Audit Node just attached results, and Validate Node makes the decision.
        // Actually, looking at VALID_TRANSITIONS: audit -> validate.
        status: "validating",
        auditResults: auditResult,
        logs: [...logs, "AuditNode: Scan complete."]
    };
}
