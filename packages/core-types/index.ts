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

/** Locked Run model for MVP (Phase B). */
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

/** AgentTraceBlob v1 shape for EigenDA / run_steps. */
export interface AgentTraceBlob {
  version: string;
  run_id: string;
  step_type: string;
  step_index: number;
  status: string;
  output_summary?: string;
  error_message?: string | null;
}
