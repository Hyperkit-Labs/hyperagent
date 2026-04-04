/**
 * Shared types for API and UI.
 */

export interface WorkflowStage {
  name?: string;
  stage?: string;
  status: string;
  error?: string;
  cycles?: number;
}

export interface Workflow {
  workflow_id: string;
  name?: string;
  intent?: string;
  contract_type?: string;
  status: string;
  network?: string;
  stages?: WorkflowStage[];
  spec?: unknown;
  spec_approved?: boolean;
  needs_human_approval?: boolean;
  created_at?: string;
  updated_at?: string;
  meta_data?: {
    wallet_address?: string;
    error?: string;
    deployment_status?: string;
    requires_user_signature?: boolean;
  };
  metadata?: {
    wallet_address?: string;
    error?: string;
    deployment_status?: string;
    requires_user_signature?: boolean;
  };
  template_id?: string;
  codegen_mode?: "oz_wizard" | "custom";
  oz_wizard_options?: { kind?: string; options?: Record<string, unknown> };
  roma_used?: boolean;
  risk_profile?: string;
  ui_schema?: unknown;
  contracts?: Record<string, string>;
  deployments?: Array<{
    chain_id?: number;
    contract_name?: string;
    contract_address?: string;
    network?: string;
    transaction_hash?: string;
    created_at?: string;
    plan?: unknown;
  }>;
  audit_findings?: Array<{
    tool?: string;
    severity?: string;
    title?: string;
    description?: string;
    [key: string]: unknown;
  }>;
  simulation_passed?: boolean;
  simulation_results?: unknown;
  auto_approve?: boolean;
  /** Pipeline stage from backend (e.g. awaiting_deploy_approval). */
  current_stage?: string;
  autofix_cycle?: number;
  autofix_history?: Array<{ cycle: number; error_context: string }>;
  invariant_violations?: Array<{ invariant: string; severity: string }>;
  estimated_complexity?: string;
  estimated_token_cost?: number;
  design_rationale?: string;
}

/** True when workflow needs user to approve spec before pipeline continues. */
export function needsSpecApproval(w: Workflow): boolean {
  if (w.auto_approve) return false;
  return Boolean(
    (w.status === "building" ||
      w.status === "running" ||
      w.status === "spec_review") &&
    w.spec &&
    (w.needs_human_approval === true || w.spec_approved === false),
  );
}

/** True when workflow is paused at Guardian gate and needs user to approve deploy. */
export function needsDeployApproval(w: Workflow): boolean {
  return (
    (w.status === "building" || w.status === "running") &&
    w.current_stage === "awaiting_deploy_approval"
  );
}

/** True when any stage named audit or simulation has status failed. */
export function hasAuditOrSimFailure(w: {
  stages?: Array<{ name?: string; stage?: string; status?: string }>;
}): boolean {
  const stages = w.stages ?? [];
  return stages.some(
    (s) =>
      (s.name === "audit" ||
        s.stage === "audit" ||
        s.name === "simulation" ||
        s.stage === "simulation") &&
      (s.status === "failed" || s.status === "error"),
  );
}

/** True when security_check stage failed (sensitive data detected). */
export function hasSecurityCheckFailure(w: {
  stages?: Array<{ name?: string; stage?: string; status?: string }>;
  current_stage?: string;
}): boolean {
  if (w.current_stage === "failed") return true;
  const stages = w.stages ?? [];
  return stages.some(
    (s) =>
      (s.name === "security_check" || s.stage === "security_check") &&
      (s.status === "failed" || s.status === "error"),
  );
}

export interface Network {
  id: string;
  name?: string;
  chain_id?: number;
  network_id?: string;
}

export interface HealthStatus {
  status: string;
  services?: Record<string, { status: string }>;
}

export interface Template {
  id: string;
  name?: string;
  description?: string;
  source?: string;
  codegen_mode?: "oz_wizard" | "custom";
  risk_profile?: string;
  requires_human_approval?: boolean;
  wizard_kind?: string;
  wizard_options?: Record<string, unknown>;
}

/** Contract returned by GET /workflows/{id}/contracts */
export interface WorkflowContract {
  id?: string;
  contract_name?: string;
  contract_type?: string;
  source_code?: string;
  bytecode?: string;
  abi?: unknown;
  source_code_hash?: string;
  deployed_bytecode?: string;
  [key: string]: unknown;
}
