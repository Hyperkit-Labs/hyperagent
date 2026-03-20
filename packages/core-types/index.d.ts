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

export interface SimulateBundleRequest {
  simulations: SimulateBundleTx[];
  block_number?: number | string | null;
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
  simulation_type?: "full" | "quick" | "abi";
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
