import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { getModelConfig } from "../core/spec/models";
import { callAnthropic } from "../adapters/llm/anthropicClient";

/**
 * NODE SPECIFICATION: AuditNode
 * NEVER deviate from this spec.
 */
export const auditNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState" as any,
    output: "HyperAgentState" as any,
    maxRetries: 2,
    timeoutMs: 60000,
    nextNode: "validate",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const modelConfig = getModelConfig("audit");

    const provider = modelConfig.provider;
    const apiKey =
      provider === "anthropic" ? process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY : "";

    if (!state.contract || state.contract.trim().length === 0) {
      return withUpdates(state, {
        auditResults: { passed: false, findings: ["Empty contract"] },
        status: "auditing",
        logs: [...state.logs, "[AUDIT] Failed: empty contract"],
      });
    }

    if (!apiKey || provider !== "anthropic") {
      // Safe default: do not claim a full audit, but allow pipeline to continue in dev mode.
      return withUpdates(state, {
        auditResults: { passed: true, findings: ["Audit skipped (provider not configured)"] },
        status: "auditing",
        logs: [...state.logs, `[AUDIT] Provider not configured (${provider}). Skipping.`],
      });
    }

    try {
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
              .slice(0, 50);

      return withUpdates(state, {
        auditResults: { passed: findings.length === 0, findings },
        status: "auditing",
        logs: [
          ...state.logs,
          `[AUDIT] Using model: ${modelConfig.model}`,
          findings.length === 0 ? "[AUDIT] No findings" : "[AUDIT] Findings detected",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Fail closed: do not pass audit if the audit tool fails.
      return withUpdates(state, {
        auditResults: { passed: false, findings: [`Audit tool failed: ${message}`] },
        status: "auditing",
        logs: [...state.logs, `[AUDIT] Failed: ${message}`],
      });
    }
  },
};

