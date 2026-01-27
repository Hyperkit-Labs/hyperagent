/**
 * Helper functions for auditNode
 * Extracted to improve Single Responsibility Principle
 */

import { PythonAuditResponse } from "../adapters/audit/pythonAuditClient";

/**
 * Validate contract before auditing
 */
export function validateContractForAudit(contract: string): { valid: boolean; error?: string } {
  if (!contract || contract.trim().length === 0) {
    return { valid: false, error: "Empty contract" };
  }

  if (contract.length < 10) {
    return { valid: false, error: "Contract too short" };
  }

  return { valid: true };
}

/**
 * Parse audit findings from Python backend response
 */
export function parseAuditFindings(response: PythonAuditResponse): string[] {
  if (!response.vulnerabilities || response.vulnerabilities.length === 0) {
    return [];
  }

  return response.vulnerabilities
    .map((vuln) => {
      if (typeof vuln === "string") {
        return vuln;
      }
      if (vuln && typeof vuln === "object" && "description" in vuln) {
        return String(vuln.description);
      }
      return String(vuln);
    })
    .filter((f) => f.length > 0)
    .slice(0, 50); // Limit findings
}

/**
 * Determine audit status from response
 */
export function determineAuditStatus(response: PythonAuditResponse): {
  passed: boolean;
  findings: string[];
} {
  const findings = parseAuditFindings(response);
  const passed = response.audit_status === "passed" && findings.length === 0;

  return { passed, findings };
}

