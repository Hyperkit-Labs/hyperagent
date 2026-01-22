import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { getModelConfig } from "../core/spec/models";
import { callAnthropic } from "../adapters/llm/anthropicClient";
import { buildContractPrompt } from "../adapters/llm/prompts";
import { FALLBACK_CONTRACTS } from "../core/spec/errors";

/**
 * NODE SPECIFICATION: GenerateNode
 * NEVER deviate from this spec.
 */
export const generateNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState" as any,
    output: "HyperAgentState" as any,
    maxRetries: 3,
    timeoutMs: 30000,
    nextNode: "audit",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const modelConfig = getModelConfig("generate");

    const provider = modelConfig.provider;
    const apiKey =
      provider === "anthropic" ? process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY : "";

    const prompt = buildContractPrompt(state.intent, []);

    if (!apiKey || provider !== "anthropic") {
      const fallback = FALLBACK_CONTRACTS.erc20;
      return withUpdates(state, {
        contract: fallback,
        status: "processing",
        logs: [
          ...state.logs,
          `[GENERATE] Provider not configured (${provider}). Using fallback contract.`,
        ],
      });
    }

    try {
      const raw = await callAnthropic(
        {
          apiKey,
          model: modelConfig.model,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        },
        [{ role: "user", content: prompt }],
      );

      const text = normalizeSolidityOutput(raw);
      return withUpdates(state, {
        contract: text,
        status: "processing",
        logs: [
          ...state.logs,
          `[GENERATE] Using model: ${modelConfig.model}`,
          "[GENERATE] Contract generated",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = FALLBACK_CONTRACTS.erc20;
      return withUpdates(state, {
        contract: fallback,
        status: "processing",
        logs: [
          ...state.logs,
          `[GENERATE] Generation failed, using fallback. Error: ${message}`,
        ],
      });
    }
  },
};

function normalizeSolidityOutput(text: string): string {
  // Remove common Markdown fences and leading/trailing noise
  let out = text.trim();
  out = out.replace(/^```solidity\\s*/i, "");
  out = out.replace(/^```\\s*/i, "");
  out = out.replace(/```\\s*$/i, "");
  return out.trim();
}

