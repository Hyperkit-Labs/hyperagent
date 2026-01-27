import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { HyperAgentState } from "../types/agent";

// Slither tool wrapper
export class SlitherAdapter {
    static async runAudit(contractCode: string): Promise<{ passed: boolean; findings: string[] }> {
        console.log("  🔍 [AuditNode] Running Slither (via Docker wrapper)...");

        const findings: string[] = [];
        const tempFile = path.join(process.cwd(), "contracts", `TempAudit_${Date.now()}.sol`);

        try {
            // Write contract to temp file for Slither
            if (!fs.existsSync(path.join(process.cwd(), "contracts"))) {
                fs.mkdirSync(path.join(process.cwd(), "contracts"));
            }
            fs.writeFileSync(tempFile, contractCode);

            // Invoke slither wrapper
            const scriptPath = path.join(process.cwd(), "scripts", "slither.sh");

            if (fs.existsSync(scriptPath)) {
                console.log(`  🛠 [AuditNode] Executing: ${scriptPath}`);
                const output = execSync(`bash ${scriptPath} ${tempFile}`, { encoding: "utf8", stdio: "pipe" });
                // Note: Real Slither output parsing would go here.
                // For MVP, we check if the command succeeded and look for "CRITICAL" in text
                if (output.toLowerCase().includes("critical")) {
                    findings.push("Slither detected CRITICAL vulnerabilities.");
                }
            } else {
                console.warn("  ⚠️ [AuditNode] Slither script not found. Using semantic fallback.");
                this.runSemanticChecks(contractCode, findings);
            }
        } catch (error: any) {
            console.warn("  ⚠️ [AuditNode] Slither execution failed (likely Docker missing). Using semantic fallback.");
            this.runSemanticChecks(contractCode, findings);
        } finally {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }

        return {
            passed: findings.filter(f => f.startsWith("CRITICAL")).length === 0,
            findings
        };
    }

    private static runSemanticChecks(contractCode: string, findings: string[]) {
        if (!contractCode.includes("SPDX-License-Identifier")) {
            findings.push("CRITICAL: Missing SPDX-License-Identifier");
        }
        if (!contractCode.includes("pragma solidity")) {
            findings.push("CRITICAL: Missing pragma solidity version");
        }
        
        // Basic Reentrancy check
        if (contractCode.includes(".call{") && !contractCode.toLowerCase().includes("reentrancyguard") && !contractCode.toLowerCase().includes("nonreentrant")) {
            findings.push("CRITICAL: Potential Reentrancy vulnerability. Low-level call used without ReentrancyGuard.");
        }

        // Access Control check
        const hasSensitiveKeywords = contractCode.includes("selfdestruct") || contractCode.includes("delegatecall") || contractCode.includes("setOwner");
        if (hasSensitiveKeywords && !contractCode.includes("onlyOwner") && !contractCode.includes("AccessControl")) {
            findings.push("CRITICAL: Sensitive operations found without visible Access Control (onlyOwner/AccessControl).");
        }

        // Visibility check
        if (contractCode.includes("mapping") && !contractCode.includes("public") && !contractCode.includes("private") && !contractCode.includes("internal")) {
            findings.push("WARNING: State variables found with default visibility. Explicitly set library/public/private.");
        }
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
