/**
 * Helper functions for generateNode
 * Extracted to improve Single Responsibility Principle
 */

import { HyperAgentState } from "../core/spec/state";
import { ChromaSearchResult } from "../adapters/memory/chromaClient";
import { buildContractPrompt } from "../adapters/llm/prompts";

/**
 * Search memory for similar contracts
 */
export async function searchSimilarContracts(
  intent: string,
  findSimilar: (query: string, limit: number) => Promise<ChromaSearchResult[]>,
  limit: number,
): Promise<string[]> {
  try {
    const similarResults = await findSimilar(intent, limit);
    return similarResults.map((r) => r.content);
  } catch (error) {
    // Graceful degradation: return empty array
    return [];
  }
}

/**
 * Build prompt with reference contracts
 */
export function buildPromptWithReferences(
  intent: string,
  referenceContracts: string[],
): string {
  return buildContractPrompt(intent, referenceContracts);
}

/**
 * Normalize Solidity output from LLM
 * Removes markdown fences and cleans up output
 */
export function normalizeSolidityOutput(text: string): string {
  let out = text.trim();
  out = out.replace(/^```solidity\s*/i, "");
  out = out.replace(/^```\s*/i, "");
  out = out.replace(/```\s*$/i, "");
  return out.trim();
}

/**
 * Validate generated contract
 */
export function validateGeneratedContract(contract: string): boolean {
  return contract.length > 0 && contract.includes("pragma solidity");
}

