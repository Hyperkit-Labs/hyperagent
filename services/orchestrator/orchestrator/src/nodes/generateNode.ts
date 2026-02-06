import { HyperAgentState, withUpdates } from "../core/spec/state";
import { NodeDefinition, NodeImplementation } from "../core/spec/nodes";
import { getModelConfig } from "../core/spec/models";
import { callAnthropic } from "../adapters/llm/anthropicClient";
import { FALLBACK_CONTRACTS } from "../core/spec/errors";
import { MEMORY_INTEGRATION_POINTS } from "../core/spec/memory";
import { createChromaClient } from "../adapters/memory/chromaClient";
import { config } from "../config/env";
import { NODE_TIMEOUTS, NODE_RETRIES, MEMORY_CONFIG } from "../core/constants";
import { logNodeExecution, logError } from "../core/logger";
import {
  searchSimilarContracts,
  buildPromptWithReferences,
  normalizeSolidityOutput,
} from "./generateNode.helpers";

/**
 * NODE SPECIFICATION: GenerateNode
 * NEVER deviate from this spec.
 * 
 * Implements MEMORY_INTEGRATION_POINTS.generate:
 * - find_similar: Search Chroma for similar contracts by intent
 * - Enhance LLM prompt with reference contracts
 */
export const generateNode: NodeImplementation = {
  definition: {
    input: "HyperAgentState",
    output: "HyperAgentState",
    maxRetries: NODE_RETRIES.GENERATE,
    timeoutMs: NODE_TIMEOUTS.GENERATE,
    nextNode: "audit",
  },
  async execute(state: HyperAgentState): Promise<HyperAgentState> {
    const logs = [...state.logs];
    const modelConfig = getModelConfig("generate");

    const provider = modelConfig.provider;
    const apiKey =
      provider === "anthropic" ? config.ANTHROPIC_API_KEY || config.CLAUDE_API_KEY || "" : "";

    // MEMORY_INTEGRATION_POINTS.generate: find_similar
    // Search Chroma for similar contracts to enhance prompt
    const integrationPoint = MEMORY_INTEGRATION_POINTS.generate;
    logNodeExecution("generate", state.meta, `Searching memory for similar contracts (${integrationPoint.operation})`);
    logs.push(`[GENERATE] Searching memory for similar contracts (${integrationPoint.operation})`);
    
    const chromaClient = createChromaClient();
    const referenceContracts = await searchSimilarContracts(
      state.intent,
      chromaClient.findSimilar.bind(chromaClient),
      MEMORY_CONFIG.DEFAULT_SEARCH_LIMIT,
    );
    
    if (referenceContracts.length > 0) {
      logNodeExecution("generate", state.meta, `Found ${referenceContracts.length} similar contracts in memory`);
      logs.push(`[GENERATE] Found ${referenceContracts.length} similar contracts in memory`);
    } else {
      logs.push("[GENERATE] No similar contracts found in memory");
    }

    // Build prompt with reference contracts
    const prompt = buildPromptWithReferences(state.intent, referenceContracts);

    if (!apiKey || provider !== "anthropic") {
      const fallback = FALLBACK_CONTRACTS.erc20;
      return withUpdates(state, {
        contract: fallback,
        status: "processing",
        logs: [
          ...logs,
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
          ...logs,
          `[GENERATE] Using model: ${modelConfig.model}`,
          "[GENERATE] Contract generated",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = FALLBACK_CONTRACTS.erc20;
      
      if (error instanceof Error) {
        logError(error, { node: "generate", workflowId: state.meta.workflowId });
      }
      
      logs.push(`[GENERATE] Generation failed, using fallback. Error: ${message}`);
      
      return withUpdates(state, {
        contract: fallback,
        status: "processing",
        logs,
      });
    }
  },
};

