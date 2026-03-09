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
