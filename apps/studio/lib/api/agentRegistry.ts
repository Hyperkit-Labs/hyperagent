/**
 * ERC-8004 / A2A operational index (orchestrator).
 * Paths are relative to /api/v1 (gateway → orchestrator).
 */

import { fetchJsonAuthed, type FetchJsonOptions } from "./core";

// --- Agent registry ---

export interface RegistryAgentRow {
  id: string;
  owner_service?: string;
  name?: string;
  registry_cid?: string | null;
  capabilities?: string[] | unknown;
  chain_id?: number;
  status?: string;
  metadata?: Record<string, unknown>;
  wallet_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  trust_score_latest?: number;
}

export interface RegisterAgentBody {
  owner_service: string;
  name: string;
  capabilities?: string[];
  chain_id: number;
  registry_cid?: string | null;
  metadata?: Record<string, unknown>;
  wallet_user_id?: string | null;
}

export async function registerRegistryAgent(
  body: RegisterAgentBody,
  options?: FetchJsonOptions,
): Promise<{ agent_id: string; status: string; registry_cid?: string | null }> {
  return fetchJsonAuthed("/agent-registry/agents", {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export async function getRegistryAgent(
  agentId: string,
  options?: FetchJsonOptions,
): Promise<RegistryAgentRow> {
  return fetchJsonAuthed(
    `/agent-registry/agents/${encodeURIComponent(agentId)}`,
    options,
  );
}

export async function listRegistryAgents(
  params?: {
    capability?: string;
    chain_id?: number;
    status?: string;
    owner_service?: string;
    discoverable_only?: boolean;
    limit?: number;
  },
  options?: FetchJsonOptions,
): Promise<{ agents: RegistryAgentRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.capability) q.set("capability", params.capability);
  if (params?.chain_id !== undefined)
    q.set("chain_id", String(params.chain_id));
  if (params?.status) q.set("status", params.status);
  if (params?.owner_service) q.set("owner_service", params.owner_service);
  if (params?.discoverable_only === false) q.set("discoverable_only", "false");
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const qs = q.toString();
  return fetchJsonAuthed(
    `/agent-registry/agents${qs ? `?${qs}` : ""}`,
    options,
  );
}

export async function deprecateRegistryAgent(
  agentId: string,
  options?: FetchJsonOptions,
): Promise<{ agent_id: string; status: string }> {
  return fetchJsonAuthed(
    `/agent-registry/agents/${encodeURIComponent(agentId)}/deprecate`,
    { method: "POST", ...options },
  );
}

export async function postRegistryAttestation(
  agentId: string,
  body: {
    attester: string;
    type: string;
    attestation_cid?: string | null;
    score_delta?: number | null;
  },
  options?: FetchJsonOptions,
): Promise<{ attestation_id: string; status: string }> {
  return fetchJsonAuthed(
    `/agent-registry/agents/${encodeURIComponent(agentId)}/attestations`,
    { method: "POST", body: JSON.stringify(body), ...options },
  );
}

export async function getRegistryReputation(
  agentId: string,
  options?: FetchJsonOptions,
): Promise<{
  agent_id: string;
  latest_score: number | null;
  history: Array<Record<string, unknown>>;
}> {
  return fetchJsonAuthed(
    `/agent-registry/agents/${encodeURIComponent(agentId)}/reputation`,
    options,
  );
}

export async function listRegistryCapabilities(
  options?: FetchJsonOptions,
): Promise<{ capabilities: string[] }> {
  return fetchJsonAuthed("/agent-registry/capabilities", options);
}

export async function listAgentsForCapability(
  name: string,
  params?: { chain_id?: number; limit?: number },
  options?: FetchJsonOptions,
): Promise<{ capability: string; agents: RegistryAgentRow[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.chain_id !== undefined)
    q.set("chain_id", String(params.chain_id));
  if (params?.limit !== undefined) q.set("limit", String(params.limit));
  const qs = q.toString();
  return fetchJsonAuthed(
    `/agent-registry/capabilities/${encodeURIComponent(name)}/agents${qs ? `?${qs}` : ""}`,
    options,
  );
}

// --- A2A tasks ---

export interface A2aTaskRow {
  id: string;
  workflow_id?: string | null;
  run_id?: string;
  capability_requested?: string;
  selected_agent_id?: string | null;
  status?: string;
  priority?: string;
  timeout_seconds?: number;
  payload_cid?: string | null;
  trace_id?: string;
  selection_reason?: string | null;
  trust_score?: number | null;
  created_at?: string;
  updated_at?: string;
}

export async function createA2aTask(
  body: {
    workflow_id?: string | null;
    run_id: string;
    capability_requested: string;
    priority?: "low" | "normal" | "high";
    timeout_seconds?: number;
    payload_cid?: string | null;
    trace_id: string;
  },
  options?: FetchJsonOptions,
): Promise<{ task_id: string; status: string }> {
  return fetchJsonAuthed("/a2a/tasks", {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export async function getA2aTask(
  taskId: string,
  options?: FetchJsonOptions,
): Promise<A2aTaskRow> {
  return fetchJsonAuthed(`/a2a/tasks/${encodeURIComponent(taskId)}`, options);
}

export async function dispatchA2aTask(
  taskId: string,
  body: { agent_id: string; selection_reason?: string | null },
  options?: FetchJsonOptions,
): Promise<{ status: string; agent_id: string }> {
  return fetchJsonAuthed(`/a2a/tasks/${encodeURIComponent(taskId)}/dispatch`, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export async function ackA2aTask(
  taskId: string,
  options?: FetchJsonOptions,
): Promise<{ status: string }> {
  return fetchJsonAuthed(`/a2a/tasks/${encodeURIComponent(taskId)}/ack`, {
    method: "POST",
    ...options,
  });
}

export async function completeA2aTask(
  taskId: string,
  body: {
    output_cid?: string | null;
    summary?: string;
    success?: boolean;
    artifact_type?: string;
  },
  options?: FetchJsonOptions,
): Promise<Record<string, unknown>> {
  return fetchJsonAuthed(`/a2a/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export async function failA2aTask(
  taskId: string,
  body: { error: string; error_cid?: string | null; retryable?: boolean },
  options?: FetchJsonOptions,
): Promise<Record<string, unknown>> {
  return fetchJsonAuthed(`/a2a/tasks/${encodeURIComponent(taskId)}/fail`, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

export async function listA2aTaskMessages(
  taskId: string,
  options?: FetchJsonOptions,
): Promise<{ task_id: string; messages: unknown[]; total: number }> {
  return fetchJsonAuthed(
    `/a2a/tasks/${encodeURIComponent(taskId)}/messages`,
    options,
  );
}

export async function listA2aTaskArtifacts(
  taskId: string,
  options?: FetchJsonOptions,
): Promise<{ task_id: string; artifacts: unknown[]; total: number }> {
  return fetchJsonAuthed(
    `/a2a/tasks/${encodeURIComponent(taskId)}/artifacts`,
    options,
  );
}

// --- ERC-8004 sync (operational mirror) ---

export async function syncErc8004Registry(
  options?: FetchJsonOptions,
): Promise<{ synced: number; message?: string }> {
  return fetchJsonAuthed("/erc8004/sync", { method: "POST", ...options });
}

export async function getErc8004AgentMirror(
  agentId: string,
  options?: FetchJsonOptions,
): Promise<{
  agent: RegistryAgentRow;
  anchored: boolean;
  source: string;
}> {
  return fetchJsonAuthed(
    `/erc8004/agents/${encodeURIComponent(agentId)}`,
    options,
  );
}
