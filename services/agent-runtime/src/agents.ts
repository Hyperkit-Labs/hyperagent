/**
 * Spec, design, and codegen agents using AI SDK. BYOK via context.apiKeys.
 */

import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
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

function getModel(provider: string, modelId: string, apiKey: string): LanguageModelV1 {
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
Output only valid JSON with: version, token_type (ERC20|ERC721|ERC1155|custom), template_id (optional; use when request matches: erc20-standard, erc20-upgradeable, erc721-standard, erc721-community, erc4626-vault, lending-basic, marketplace-nft, governance-basic, multisig-gnosis, amm-uniswap-style), app_type (token|lending|marketplace|governance|multisig|amm), multi_contract (boolean; true when design requires multiple contracts e.g. lending pool + collateral token, marketplace + NFT, governor + token, multisig, AMM factory + pair), chains ([{chain_id, network_name}]), features (array), roles (array), invariants (array), risk_profile (low|medium|high), oracles (optional; array of price feed or oracle requirements when Chainlink or price feeds mentioned), frontend_actions (optional; array of user actions: deposit, withdraw, borrow, repay, liquidate, list, buy, cancelListing, propose, vote, queue, execute, submitTransaction, confirmTransaction, swap, addLiquidity, removeLiquidity), wizard_options (optional; merge into OZ wizard when using templates: name, symbol, premint/initialSupply as string e.g. "1000000", mintable, burnable, pausable). Extract token name/symbol and initial supply from the prompt when specified.`,
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

export interface SecurityContext {
  threatsSummary?: string;
  scvPatterns?: string;
  owaspConstraints?: string;
}

export async function designAgent(
  spec: Record<string, unknown>,
  targetChains: unknown[],
  context: AgentContext,
  securityContext?: SecurityContext | null,
): Promise<DesignProposal> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  let system = `You are a smart contract design agent. Given a spec and target chains, output a design as JSON: { components: string[], frameworks: { primary: "hardhat"|"foundry" }, chains: [{ chainId: number, deploymentStrategy: string }], usesCommunityContracts: boolean (true only if using OpenZeppelin community-contracts extensions) }. Output only valid JSON.`;
  if (securityContext?.threatsSummary || securityContext?.scvPatterns || securityContext?.owaspConstraints) {
    system += `\n\nSECURITY CONSTRAINTS (mandatory):\n- Avoid: ${securityContext.threatsSummary || "N/A"}\n- OWASP Top 10 2025: ${securityContext.owaspConstraints || "Access Control, Reentrancy, Oracle Manipulation, Unchecked External Calls, Front-Running, Signature Replay, Integer Overflow, DoS, Weak Randomness, Upgradeable Risks"}\n- Known SCV patterns to avoid: ${securityContext.scvPatterns || "N/A"}`;
  }
  const result = await generateText({
    model,
    system,
    prompt: `Spec: ${JSON.stringify(spec)}\nTarget chains: ${JSON.stringify(targetChains)}`,
    maxTokens: 2048,
  });
  try {
    return JSON.parse(result.text) as DesignProposal;
  } catch {
    return { components: ["Contract"], frameworks: { primary: "hardhat" }, chains: (targetChains as { chain_id?: number }[]).map((c) => ({ chainId: c.chain_id ?? 1, deploymentStrategy: "eoa" })) };
  }
}

const FILE_MARKER_RE = /\/\/\s*={0,3}\s*FILE:\s*([A-Za-z0-9_.-]+\.sol)\s*={0,3}\s*\n/g;

function parseMultiFileOutput(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const parts = text.split(FILE_MARKER_RE);
  for (let i = 1; i < parts.length; i += 2) {
    const filename = parts[i].trim();
    const content = (parts[i + 1] || "").trim();
    if (filename && filename.endsWith(".sol") && content) {
      files[filename] = content;
    }
  }
  if (Object.keys(files).length > 0) return files;
  return { "Contract.sol": text.trim() };
}

export async function codegenAgent(
  spec: Record<string, unknown>,
  design: DesignProposal,
  context: AgentContext,
  securityContext?: SecurityContext | null,
): Promise<Record<string, string>> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  let system = `You are a Solidity codegen agent. Generate production-ready Solidity. Use SPDX, pragma ^0.8.0, events, access control. Use only imports from @openzeppelin/contracts and @openzeppelin/community-contracts; do not edit OpenZeppelin source; add custom logic in separate contracts or composition. Output only code, no markdown.

MANDATORY NatSpec documentation: Add high-level documentation comments to every contract and public/external function.
- For each contract: /// @title ContractName - one-line purpose
- For each contract: /// @notice One or two sentences describing what the contract does
- For each public/external function: /// @notice Brief description of behavior
- For each function with params: /// @param paramName Description
- For each function with return value: /// @return Description of return value
- For events: /// @param paramName Description`;
  if (securityContext?.threatsSummary || securityContext?.scvPatterns) {
    system += `\n\nMUST AVOID: ${securityContext.threatsSummary || "N/A"}\n- Reentrancy: use checks-effects-interactions, nonReentrant modifier\n- Unhandled exceptions: check return values of call/transfer/send\n- Known SCV patterns: ${securityContext.scvPatterns || "N/A"}`;
  }
  const components = design?.components || ["Contract"];
  const multiContract = components.length > 1;
  if (multiContract) {
    system += `\n\nWhen design has multiple components, generate ALL contracts needed. Start each contract with a file marker on its own line: // FILE: ComponentName.sol (e.g. // FILE: Token.sol, // FILE: Vault.sol). Output each contract in full with its marker.`;
  }
  const oracles = (spec as { oracles?: unknown[] })?.oracles;
  const templateId = (spec as { template_id?: string })?.template_id;
  const needsChainlink = (Array.isArray(oracles) && oracles.length > 0) || templateId === "lending-basic";
  if (needsChainlink) {
    system += `\n\nORACLE (Chainlink): When spec.oracles is present or template is lending-basic, integrate Chainlink price feeds for collateral valuation.
- Import interface: interface AggregatorV3Interface { function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound); }
- Store price feed address per collateral (e.g. mapping(address => address) public priceFeeds)
- Use latestRoundData() to get price (answer is 8 decimals for USD pairs)
- For lending: compute collateral value in USD, debt value in USD, health factor = (collateralValue * LTV) / debtValue
- Common mainnet feeds: ETH/USD 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419, BTC/USD 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c`;
  }
  const prompt = multiContract
    ? `Spec: ${JSON.stringify(spec)}\nDesign: ${JSON.stringify(design)}\nGenerate all contracts needed for the design (${components.join(", ")}). Use // FILE: Name.sol before each contract.`
    : `Spec: ${JSON.stringify(spec)}\nDesign: ${JSON.stringify(design)}\nGenerate one main contract.`;
  const result = await generateText({
    model,
    system,
    prompt,
    maxTokens: 8192,
  });
  return parseMultiFileOutput(result.text);
}

export async function testAgent(
  contracts: Record<string, string>,
  spec: Record<string, unknown>,
  design: DesignProposal,
  context: AgentContext,
): Promise<Record<string, string>> {
  const { provider, modelId, apiKey } = resolveModel(context, "anthropic");
  const model = getModel(provider, modelId, apiKey);
  const contractSummary = Object.entries(contracts)
    .map(([name, code]) => `// ${name}\n${typeof code === "string" ? code.slice(0, 4000) : ""}`)
    .join("\n\n");
  const result = await generateText({
    model,
    system: `You are a Solidity test agent. Generate Foundry (forge test) or Hardhat tests for the given contracts.
Output only test code. Use forge-std for Foundry or Hardhat's expect. Include:
- Deployment setup, basic unit tests for main functions, edge cases
- Assertion-heavy tests (assert(...)) for invariants and pre/post conditions
- Echidna-style invariant_ functions when applicable (e.g. invariant_balance(), invariant_totalSupply())
Echidna invariants must be executable properties; use invariant_ prefix for fuzzing.
Use // FILE: Contract.t.sol before each test file. Output only code with file markers.`,
    prompt: `Spec: ${JSON.stringify(spec)}\nDesign: ${JSON.stringify(design)}\n\nContracts:\n${contractSummary}\n\nGenerate comprehensive tests including invariant_ functions for security properties.`,
    maxTokens: 8192,
  });
  return parseMultiFileOutput(result.text);
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


export interface PashovAuditInput {
  systemPrompt: string;
  userPrompt: string;
  context: AgentContext;
}

export async function pashovAuditAgent(input: PashovAuditInput): Promise<{ text: string }> {
  const { provider, modelId, apiKey } = resolveModel(input.context, "anthropic");
  const model = getModel(provider, modelId, apiKey);

  const result = await generateText({
    model,
    system: input.systemPrompt,
    prompt: input.userPrompt,
    maxTokens: 8192,
  });

  return { text: result.text };
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
