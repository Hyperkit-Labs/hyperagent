/**
 * Python backend audit client
 * Calls Python backend /api/v1/audit endpoint for Slither-based auditing
 * 
 * Falls back to LLM audit if Python backend is unavailable
 */

export interface AuditFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  location?: string;
}

export interface PythonAuditResponse {
  status: "success" | "error";
  vulnerabilities?: AuditFinding[];
  overall_risk_score?: number;
  audit_status?: "passed" | "failed";
  error?: string;
}

export interface PythonAuditClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

// Import config at top of file
import { config } from "../../config/env";

const DEFAULT_CONFIG: Required<PythonAuditClientConfig> = {
  baseUrl: config.PYTHON_BACKEND_URL || "http://localhost:8000",
  timeoutMs: 60000,
};

/**
 * Python backend audit client
 * Calls Python backend for Slither-based security auditing
 */
export class PythonAuditClient {
  private config: Required<PythonAuditClientConfig>;

  constructor(config: PythonAuditClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Audit contract using Python backend Slither integration
   * 
   * @param contractCode - Solidity contract source code
   * @returns Audit results with findings and risk score
   */
  async auditContract(contractCode: string): Promise<PythonAuditResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch(`${this.config.baseUrl}/api/v1/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contract_code: contractCode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python backend audit failed: ${response.status} ${errorText}`);
      }

      const data = await response.json() as PythonAuditResponse;
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      // If it's a network error or timeout, return error response
      if (error instanceof Error && error.name === "AbortError") {
        return {
          status: "error",
          error: "Audit request timed out",
        };
      }

      return {
        status: "error",
        error: `Python backend unavailable: ${message}`,
      };
    }
  }

  /**
   * Check if Python backend is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Map Python backend audit findings to orchestrator format
   */
  mapFindingsToOrchestratorFormat(
    response: PythonAuditResponse,
  ): { passed: boolean; findings: string[] } {
    if (response.status === "error" || !response.vulnerabilities) {
      return {
        passed: false,
        findings: [response.error || "Audit failed"],
      };
    }

    const findings: string[] = [];

    // Group findings by severity
    const critical: string[] = [];
    const high: string[] = [];
    const medium: string[] = [];
    const low: string[] = [];

    for (const vuln of response.vulnerabilities) {
      const finding = `${vuln.severity.toUpperCase()}: ${vuln.title}${vuln.description ? ` - ${vuln.description}` : ""}${vuln.location ? ` (${vuln.location})` : ""}`;
      
      switch (vuln.severity) {
        case "critical":
          critical.push(finding);
          break;
        case "high":
          high.push(finding);
          break;
        case "medium":
          medium.push(finding);
          break;
        default:
          low.push(finding);
      }
    }

    // Combine findings in severity order
    findings.push(...critical, ...high, ...medium, ...low);

    // Determine if audit passed
    const passed = response.audit_status === "passed" || findings.length === 0;

    return { passed, findings };
  }
}

/**
 * Create Python audit client with default config
 */
export function createPythonAuditClient(
  config?: PythonAuditClientConfig,
): PythonAuditClient {
  return new PythonAuditClient(config);
}

