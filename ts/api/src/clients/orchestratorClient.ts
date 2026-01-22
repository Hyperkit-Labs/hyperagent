/**
 * Thin wrapper for orchestrator
 * In-process call, no HTTP needed
 */
import {
  runGraph,
  runGraphWithRetry,
  nodeRegistry,
  initialState,
  HyperAgentState,
  NodeType,
} from "@hyperagent/orchestrator";

export interface WorkflowRequest {
  intent: string;
  startNode?: NodeType;
}

export interface WorkflowResponse {
  intent: string;
  status: string;
  contract: string;
  deploymentAddress: string;
  txHash: string;
  auditResults: { passed: boolean; findings: string[] };
  logs: string[];
}

export async function createWorkflow(
  request: WorkflowRequest,
): Promise<WorkflowResponse> {
  const initial = initialState(request.intent);
  const startNode = request.startNode || "policy";

  const finalState = await runGraphWithRetry(startNode, initial, nodeRegistry);

  return {
    intent: finalState.intent,
    status: finalState.status,
    contract: finalState.contract,
    deploymentAddress: finalState.deploymentAddress,
    txHash: finalState.txHash,
    auditResults: finalState.auditResults,
    logs: finalState.logs,
  };
}

