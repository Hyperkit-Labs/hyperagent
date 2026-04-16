/**
 * Shared request/response contracts for services and orchestrator clients.
 * Use these types in handlers and HTTP clients for explicit, consistent contracts.
 */

export interface SimulateRequest {
  network: string;
  from: string;
  to?: string;
  data: string;
  value?: string;
}

export interface SimulateTxResult {
  success: boolean;
  gasUsed?: number;
  traces?: unknown;
  simulationUrl?: string | null;
  error?: string;
}

/** Single tx for Tenderly Bundled Simulations. See https://docs.tenderly.co/simulations/bundled-simulations */
export interface SimulateBundleTx {
  network_id: string;
  from: string;
  to?: string;
  input: string;
  value?: string;
  gas?: number;
  save?: boolean;
  save_if_fails?: boolean;
  simulation_type?: "full" | "quick" | "abi";
  state_objects?: Record<string, { stateDiff?: Record<string, string>; storage?: Record<string, string> }>;
}

/** Bundle-level options per Tenderly API. See https://docs.tenderly.co/simulations/bundled-simulations */
export interface SimulateBundleRequest {
  simulations: SimulateBundleTx[];
  /** Block for all simulations: number, hex string, omit or null for latest. */
  block_number?: number | string | null;
  /** Bundle-level state overrides (plus per-tx `SimulateBundleTx.state_objects`). */
  state_objects?: Record<
    string,
    {
      nonce?: number;
      code?: string;
      balance?: string;
      storage?: Record<string, string>;
      stateDiff?: Record<string, string>;
    }
  >;
  /** Default simulation type for all txs. Individual txs can override. */
  simulation_type?: "full" | "quick" | "abi";
  /** Save all simulations to dashboard. */
  save?: boolean;
}

export interface SimulateBundleResult {
  success: boolean;
  gasUsed?: number;
  simulations?: Array<{ success: boolean; gas_used?: number; error?: string }>;
  simulationUrl?: string | null;
  error?: string;
}

export interface DeployPlanRequest {
  chainId: number;
  bytecode: string;
  abi: unknown[];
  constructorArgs?: unknown[];
  contractName?: string;
}

export interface DeployPlanResult {
  deployFromConnectedAccount: boolean;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  bytecode: string;
  abi: unknown[];
  constructorArgs: unknown[];
  contractName?: string;
}

export interface PinRequest {
  content: string;
  name: string;
}

export interface PinResult {
  cid: string;
  gatewayUrl: string;
}

/** Workflow/run/step DTOs for pipeline and Studio. */
export interface WorkflowSummary {
  workflow_id: string;
  intent?: string;
  status?: string;
  created_at?: string;
}

export interface RunSummary {
  id: string;
  workflow_id?: string;
  status?: string;
  current_stage?: string;
  created_at?: string;
}

export interface StepRecord {
  run_id: string;
  step_index: number;
  step_type: string;
  status: string;
  output_summary?: string | null;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string | null;
}

/** Locked Run model for Phase B. */
export interface Run {
  id: string;
  workflow_id?: string;
  project_id?: string;
  status: string;
  current_stage?: string;
  workflow_version?: string;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

/** Ordered step types for pipeline; one-to-one with registry pipeline. */
export type RunPlanStepType =
  | "spec"
  | "design"
  | "codegen"
  | "audit"
  | "simulation"
  | "deploy"
  | "ui_scaffold";

export interface RunPlan {
  step_types: RunPlanStepType[];
}

/** Artifact reference (cid or blob_id). */
export interface Artifact {
  type: string;
  storage_ref: string;
  run_id: string;
  step_index?: number;
}

/** Security finding from audit step. */
export interface SecurityFinding {
  run_id: string;
  severity: string;
  title: string;
  description?: string;
  source_tool?: string;
}

/** AgentTraceBlob v1 shape for run_steps trace payload. */
export interface AgentTraceBlob {
  version: string;
  run_id: string;
  step_type: string;
  step_index: number;
  status: string;
  output_summary?: string;
  error_message?: string | null;
}

// ---------------------------------------------------------------------------
// ERC-8004 Agent Identity Registry (deployed on-chain)
// ---------------------------------------------------------------------------

/**
 * Official ERC-8004 contract addresses. The identity registry is an ERC-1155
 * token contract where each agentId is a uint256 token ID.
 */
export const ERC8004_ADDRESSES = {
  SKALE_BASE_SEPOLIA: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
} as const;

export const ERC8004_CHAIN_IDS = {
  SKALE_BASE_MAINNET: 1187947933,
  SKALE_BASE_SEPOLIA: 324705682,
} as const;

// ---------------------------------------------------------------------------
// BYOK types and security utilities
// ---------------------------------------------------------------------------

export type LLMProvider = "openai" | "anthropic" | "google";

export const LLM_PROVIDERS: readonly LLMProvider[] = ["openai", "anthropic", "google"] as const;

export interface EncryptedKeyPayload {
  cipherText: string;
  iv: string;
  salt: string;
  version: number;
}

export interface ByokValidateBody {
  provider: LLMProvider;
  encryptedKey: EncryptedKeyPayload;
}

export interface ByokValidateResponse {
  valid: boolean;
  provider: LLMProvider;
  maskedKey: string;
}

export interface ByokSaveBody {
  provider: LLMProvider;
  encryptedKey: EncryptedKeyPayload;
}

export interface ByokSaveResponse {
  success: boolean;
  validatedAt: string;
}

export interface ByokDeleteResponse {
  success: boolean;
}

export interface ByokStatusResponse {
  providers: Record<LLMProvider, boolean>;
}

export function detectProviderFromKey(raw: string): LLMProvider | null {
  if (raw.startsWith("sk-ant-")) return "anthropic";
  if (raw.startsWith("sk-")) return "openai";
  if (/^AIza/.test(raw)) return "google";
  return null;
}

export function maskApiKey(raw: string): string {
  if (raw.length <= 8) return "****";
  return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
}

/**
 * Wraps sensitive key material so accidental serialization/logging
 * never reveals the raw value. Use getRawUnsafe() only at the point
 * of actual crypto or provider API usage.
 */
export class KeyMaterial {
  #value: string;
  constructor(value: string) {
    this.#value = value;
  }
  toString(): string {
    return "[REDACTED]";
  }
  toJSON(): string {
    return "[REDACTED]";
  }
  valueOf(): string {
    return "[REDACTED]";
  }
  getRawUnsafe(): string {
    return this.#value;
  }
  get masked(): string {
    return maskApiKey(this.#value);
  }
}
