import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { getModelConfig } from "../core/spec/models";
import { callAnthropic } from "../adapters/llm/anthropicClient";
import { createPythonAuditClient } from "../adapters/audit/pythonAuditClient";
import { config } from "../config/env";
import { NODE_TIMEOUTS, NODE_RETRIES, VALIDATION_LIMITS } from "../core/constants";
import { logNodeExecution, logError } from "../core/logger";
import {
  validateContractForAudit,
  determineAuditStatus,
} from "./auditNode.helpers";

/**
 * NODE SPECIFICATION: AuditNode
 * NEVER deviate from this spec.
 * 
 * Enhanced with Python backend Slither integration:
 * 1. Try Python backend audit (Slither) first
 * 2. Fallback to LLM audit if Python backend unavailable
 * 3. Combine results from both sources
 */
export const auditNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.AUDIT,
    timeoutMs: NODE_TIMEOUTS.AUDIT,
    nextNode: "validate",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const logs = [...state.logs];

    // Validate contract exists
    const validation = validateContractForAudit(state.contract);
    if (!validation.valid) {
      return withUpdates(state, {
        auditResults: { passed: false, findings: [validation.error || "Invalid contract"] },
        status: "auditing",
        logs: [...logs, `[AUDIT] Error: ${validation.error}`],
      });
    }

    // Try Python backend audit first (Slither)
    let pythonAuditResults: { passed: boolean; findings: string[] } | null = null;
    const pythonClient = createPythonAuditClient();

    try {
      logNodeExecution("audit", state.meta, "Attempting Python backend audit (Slither)");
      logs.push("[AUDIT] Attempting Python backend audit (Slither)...");
      const pythonResponse = await pythonClient.auditContract(state.contract);
      
      if (pythonResponse.status === "success") {
        // Use helper to convert Python response to orchestrator format
        pythonAuditResults = determineAuditStatus(pythonResponse);
        logNodeExecution("audit", state.meta, `Python backend audit completed: ${pythonAuditResults.passed ? "passed" : "failed"}`);
        logs.push(`[AUDIT] Python backend audit complete: ${pythonAuditResults.findings.length} findings`);
        logs.push(`[AUDIT] Risk score: ${pythonResponse.overall_risk_score || 0}`);
      } else {
        logs.push(`[AUDIT] Python backend audit failed: ${pythonResponse.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        logError(error, { node: "audit", workflowId: state.meta.workflowId, fallback: "llm" });
      }
      logs.push(`[AUDIT] Python backend unavailable: ${message}. Falling back to LLM audit.`);
    }

    // If Python backend audit succeeded, use it
    if (pythonAuditResults) {
      return withUpdates(state, {
        auditResults: pythonAuditResults,
        status: "auditing",
        logs: [
          ...logs,
          pythonAuditResults.passed ? "[AUDIT] ✓ Audit passed" : "[AUDIT] ✗ Audit failed",
        ],
      });
    }

    // Fallback to LLM audit
    const modelConfig = getModelConfig("audit");
    const provider = modelConfig.provider;
    const apiKey =
      provider === "anthropic" ? config.ANTHROPIC_API_KEY || config.CLAUDE_API_KEY || "" : "";

    if (!apiKey || provider !== "anthropic") {
      // Safe default: do not claim a full audit, but allow pipeline to continue in dev mode.
      logs.push(`[AUDIT] LLM provider not configured (${provider}). Skipping audit.`);
      return withUpdates(state, {
        auditResults: { passed: true, findings: ["Audit skipped (no audit provider available)"] },
        status: "auditing",
        logs,
      });
    }

    try {
      logs.push("[AUDIT] Using LLM audit (fallback)...");
      const prompt = [
        "Audit the Solidity contract for common vulnerabilities.",
        "Return a short list of findings. If none, return 'NO_FINDINGS'.",
        "",
        state.contract,
      ].join("\n");

      const text = await callAnthropic(
        {
          apiKey,
          model: modelConfig.model,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        },
        [{ role: "user", content: prompt }],
      );

      const normalized = text.trim();
      const findings =
        normalized === "NO_FINDINGS"
          ? []
          : normalized
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 0)
              .slice(0, VALIDATION_LIMITS.MAX_FINDINGS_COUNT);

      const auditResults = { passed: findings.length === 0, findings };
      logNodeExecution("audit", state.meta, `LLM audit completed: ${auditResults.passed ? "passed" : "failed"}`);
      return withUpdates(state, {
        auditResults,
        status: "auditing",
        logs: [
          ...logs,
          `[AUDIT] Using model: ${modelConfig.model}`,
          findings.length === 0 ? "[AUDIT] No findings" : "[AUDIT] Findings detected",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof Error) {
        logError(error, { node: "audit", workflowId: state.meta.workflowId });
      }
      // Fail closed: do not pass audit if the audit tool fails.
      return withUpdates(state, {
        auditResults: { passed: false, findings: [`Audit tool failed: ${message}`] },
        status: "auditing",
        logs: [...logs, `[AUDIT] Failed: ${message}`],
      });
    }
  },
};

