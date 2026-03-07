/**
 * Spec, design, and codegen agents using AI SDK. BYOK via context.apiKeys.
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
export type { DeployPlanResult } from "./tools.js";
export { compileContract, runSlither, storeOnIPFS, tenderlySim, deployContract } from "./tools.js";

export interface AgentContext {
  userId: string;
  projectId: string;
  runId: string;
  apiKeys: { openai?: string; anthropic?: string; google?: string; tenderly?: string; thirdweb?: string };
}

function getModel(provider: string, modelId: string, apiKey: string) {
  switch (provider) {
    case "openai": {
      const oai = createOpenAI({ apiKey });
      return oai(modelId);
    }
    case "anthropic": {
      const ant = createAnthropic({ apiKey });
      return ant(modelId);
    }
    case "google": {
      const goog = createGoogleGenerativeAI({ apiKey });
      return goog(modelId);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
};

const ALL_PROVIDERS = ["anthropic", "openai", "google"] as const;

function resolveModel(context: AgentContext, preferred: string): { provider: string; modelId: string; apiKey: string } {
  const seen = new Set<string>();
  const order: string[] = [];
  if (preferred) order.push(preferred);
  for (const p of ALL_PROVIDERS) { if (!order.includes(p)) order.push(p); }

  for (const p of order) {
    const [provider, modelId] = p.includes("/") ? p.split("/") : [p, "default"];
    if (seen.has(provider)) continue;
    seen.add(provider);
    const key = context.apiKeys[provider as keyof typeof context.apiKeys];
    if (key?.trim()) {
      const resolvedModelId = modelId === "default" ? (DEFAULT_MODELS[provider] || "gpt-4o") : modelId;
      console.info("[resolveModel] using provider=%s model=%s", provider, resolvedModelId);
      return { provider, modelId: resolvedModelId, apiKey: key };
    }
  }
  const available = Object.keys(context.apiKeys).filter((k) => context.apiKeys[k as keyof typeof context.apiKeys]?.trim());
  throw new Error(`No API key found for any provider. Available keys: [${available.join(",")}], tried: [${order.join(",")}]`);
}

export async function specAgent(prompt: string, context: AgentContext): Promise<Record<string, unknown>> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  const result = await generateText({
    model,
    system: `You are a smart contract specification agent. Parse the user's natural language into a structured JSON spec.
Output only valid JSON with: version, token_type (ERC20|ERC721|ERC1155|custom), template_id (optional; use when request matches: erc20-standard, erc20-upgradeable, erc721-standard, erc721-community, erc4626-vault), chains ([{chain_id, network_name}]), features (array), roles (array), invariants (array), risk_profile (low|medium|high).`,
    prompt,
    maxTokens: 4096,
  });
  try {
    return JSON.parse(result.text) as Record<string, unknown>;
  } catch {
    return { version: "1.0", token_type: "ERC20", chains: [], features: [], risk_profile: "medium" };
  }
}


export interface DesignProposal {
  components: string[];
  frameworks: { primary: string };
  chains: Array<{ chainId: number; deploymentStrategy: string }>;
  usesCommunityContracts?: boolean;
}

export async function designAgent(spec: Record<string, unknown>, targetChains: unknown[], context: AgentContext): Promise<DesignProposal> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  const result = await generateText({
    model,
    system: `You are a smart contract design agent. Given a spec and target chains, output a design as JSON: { components: string[], frameworks: { primary: "hardhat"|"foundry" }, chains: [{ chainId: number, deploymentStrategy: string }], usesCommunityContracts: boolean (true only if using OpenZeppelin community-contracts extensions) }. Output only valid JSON.`,
    prompt: `Spec: ${JSON.stringify(spec)}\nTarget chains: ${JSON.stringify(targetChains)}`,
    maxTokens: 2048,
  });
  try {
    return JSON.parse(result.text) as DesignProposal;
  } catch {
    return { components: ["Contract"], frameworks: { primary: "hardhat" }, chains: (targetChains as { chain_id?: number }[]).map((c) => ({ chainId: c.chain_id ?? 1, deploymentStrategy: "eoa" })) };
  }
}

export async function codegenAgent(spec: Record<string, unknown>, design: DesignProposal, context: AgentContext): Promise<Record<string, string>> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  const result = await generateText({
    model,
    system: `You are a Solidity codegen agent. Generate production-ready Solidity. Use SPDX, pragma ^0.8.0, NatSpec, events, access control. Use only imports from @openzeppelin/contracts and @openzeppelin/community-contracts; do not edit OpenZeppelin source; add custom logic in separate contracts or composition. Output only code, no markdown.`,
    prompt: `Spec: ${JSON.stringify(spec)}\nDesign: ${JSON.stringify(design)}\nGenerate one main contract.`,
    maxTokens: 8192,
  });
  return { "Contract.sol": result.text };
}


export interface AutofixInput {
  contracts: Record<string, string>;
  auditFindings: Array<{ severity?: string; description?: string; message?: string }>;
  simulationError?: string;
  designRationale?: string;
  cycle: number;
  maxCycles: number;
}

export async function autofixAgent(input: AutofixInput, context: AgentContext): Promise<Record<string, string>> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);

  const findingsSummary = input.auditFindings
    .slice(0, 10)
    .map((f) => `[${f.severity || "info"}] ${f.description || f.message || ""}`)
    .join("\n");

  const contractsText = Object.entries(input.contracts)
    .map(([name, code]) => `// ${name}\n${typeof code === "string" ? code.slice(0, 3000) : ""}`)
    .join("\n\n");

  const result = await generateText({
    model,
    system: `You are a Solidity autofix agent. You receive contracts that failed security audit or simulation.
Your task: fix ALL identified vulnerabilities while preserving the contract's purpose.
- Fix reentrancy: add nonReentrant modifiers, checks-effects-interactions pattern
- Fix access control: add proper onlyOwner/role-based guards
- Fix integer overflow: use SafeMath or Solidity 0.8+ built-in checks
- Fix gas issues: optimize storage reads, use calldata for external params
- Preserve the design rationale and business logic
Output only corrected Solidity code, no markdown or explanations.`,
    prompt: `Fix cycle ${input.cycle}/${input.maxCycles}

Design rationale: ${input.designRationale || "Not specified"}

Audit findings:
${findingsSummary || "No specific findings"}

${input.simulationError ? `Simulation error: ${input.simulationError}` : ""}

Current contracts:
${contractsText}

Generate the corrected contract(s). Output only Solidity code.`,
    maxTokens: 8192,
  });

  return { "Contract.sol": result.text };
}


export async function estimateAgent(prompt: string, context: AgentContext): Promise<{ complexity: string; estimatedTokens: number; riskFactors: string[] }> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);

  const result = await generateText({
    model,
    system: `You are a complexity estimation agent. Analyze the user's smart contract request and estimate:
1. complexity: "low" | "medium" | "high"
2. estimatedTokens: number (rough LLM token cost for the full pipeline)
3. riskFactors: string[] (e.g. "cross-chain bridge", "flash loan", "upgradeable proxy")
Output only valid JSON.`,
    prompt,
    maxTokens: 512,
  });

  try {
    return JSON.parse(result.text) as { complexity: string; estimatedTokens: number; riskFactors: string[] };
  } catch {
    return { complexity: "medium", estimatedTokens: 12000, riskFactors: [] };
  }
}
