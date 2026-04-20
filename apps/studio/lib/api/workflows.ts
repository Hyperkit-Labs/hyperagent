/**
 * Workflow, run, network, template, and platform API functions.
 */

import { FALLBACK_DEFAULT_NETWORK_ID } from "@/constants/defaults";
import type { Workflow } from "@/lib/types";
import {
  createFetchWithPayment,
  createOfficialX402Fetch,
} from "@/lib/thirdwebClient";
import type { Account } from "thirdweb/wallets";
import { getStoredSession } from "@/lib/session-store";
import {
  fetchJson,
  fetchJsonAuthed,
  normalizeApiError,
  reportApiError,
  getApiBase,
  joinApiUrlForFetch,
  type FetchJsonOptions,
} from "./core";
import {
  ApiPaths,
  networksRpcTestPath,
  runApproveSpecPath,
  runPath,
  runStepsPath,
  workflowCancelPath,
  workflowClarifyPath,
  workflowContractsPath,
  workflowDebugSandboxPath,
  workflowDeployApprovePath,
  workflowDeploymentsPath,
  workflowDiscussionStreamPath,
  workflowPath,
  workflowQuarantinePath,
  workflowRetryPath,
  workflowRollbackPath,
  workflowStatusPath,
  workflowUiAppsExportPath,
  workflowUiSchemaGeneratePath,
  workflowUiSchemaPath,
  workflowsGeneratePath,
} from "@hyperagent/api-contracts";

export const DEFAULT_NETWORK = FALLBACK_DEFAULT_NETWORK_ID;

export interface WorkflowResponse {
  workflows: Workflow[];
}

export interface NetworkConfig {
  id: string;
  network_id: string;
  name?: string;
  chain_id?: number;
  currency?: string;
  tier?: string;
  category?: string;
  is_mainnet?: boolean;
}

interface NetworkApiItem {
  network: string;
  name?: string;
  currency?: string;
  chain_id?: number;
  tier?: string;
  category?: string;
  is_mainnet?: boolean;
}

export async function getWorkflows(
  params?: { limit?: number; status?: string },
  signal?: AbortSignal,
): Promise<WorkflowResponse> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.status) q.set("status", params.status);
  const query = q.toString();
  return fetchJsonAuthed(`${ApiPaths.workflows}${query ? `?${query}` : ""}`, {
    signal,
  });
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
  return fetchJsonAuthed(workflowPath(workflowId));
}

export interface PresetItem {
  id: string;
  name?: string;
  description?: string;
  chain?: string;
  [key: string]: unknown;
}

export async function getPresets(): Promise<PresetItem[]> {
  return fetchJsonAuthed<PresetItem[]>(ApiPaths.presets).catch((e) => {
    reportApiError(e, {
      path: ApiPaths.presets,
      clientFallback: "empty_presets_array",
    });
    return [];
  });
}

export interface PlatformTrackRecord {
  audits_completed: number;
  vulnerabilities_found: number;
  security_researchers: number;
  contracts_deployed: number;
  /** Confirmed waitlist rows (separate Supabase) when configured on orchestrator. */
  beta_testers_confirmed?: number;
  source?: "database" | "env_defaults";
}

const TRACK_RECORD_DEFAULTS: PlatformTrackRecord = {
  audits_completed: 0,
  vulnerabilities_found: 0,
  security_researchers: 0,
  contracts_deployed: 0,
  beta_testers_confirmed: 0,
  source: "env_defaults",
};

export async function getPlatformTrackRecord(
  signal?: AbortSignal,
): Promise<PlatformTrackRecord> {
  // Public endpoint: use unauthenticated fetch so missing session never forces zeros on the login page.
  return fetchJson<PlatformTrackRecord>(ApiPaths.platformTrackRecord, {
    signal,
  }).catch((e) => {
    reportApiError(e, {
      path: ApiPaths.platformTrackRecord,
      clientFallback: "platform_track_record_defaults",
    });
    return TRACK_RECORD_DEFAULTS;
  });
}

export interface BlueprintItem {
  id: string;
  name?: string;
  description?: string;
  chain?: string;
  [key: string]: unknown;
}

export async function getBlueprints(): Promise<BlueprintItem[]> {
  return fetchJsonAuthed<BlueprintItem[]>(ApiPaths.blueprints).catch((e) => {
    reportApiError(e, {
      path: ApiPaths.blueprints,
      clientFallback: "empty_blueprints_array",
    });
    return [];
  });
}

export interface RunDetail {
  id: string;
  workflow_id?: string;
  status?: string;
  [key: string]: unknown;
}

export async function getRun(runId: string): Promise<RunDetail> {
  return fetchJsonAuthed<RunDetail>(runPath(runId));
}

export interface RunStep {
  step_type?: string;
  status?: string;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface RunStepsResponse {
  run_id: string;
  steps: RunStep[];
  trace_verifiable?: boolean;
}

export async function getRunSteps(runId: string): Promise<RunStepsResponse> {
  return fetchJsonAuthed<RunStepsResponse>(runStepsPath(runId));
}

export async function approveSpec(runId: string): Promise<{
  run_id: string;
  status: string;
  current_stage: string;
  message?: string;
}> {
  return fetchJsonAuthed(runApproveSpecPath(runId), {
    method: "PATCH",
  });
}

export async function approveDeploy(
  workflowId: string,
  apiKeys?: Record<string, string>,
): Promise<{ workflow_id: string; status: string; message?: string }> {
  return fetchJsonAuthed(workflowDeployApprovePath(workflowId), {
    method: "POST",
    body: JSON.stringify(apiKeys ? { api_keys: apiKeys } : {}),
  });
}

export interface CreateWorkflowBody {
  nlp_input: string;
  network: string;
  selected_tasks?: string[];
  wallet_address?: string;
  preset_id?: string;
  template_id?: string;
  contract_type?: string;
  name?: string;
  skip_audit?: boolean;
  skip_deployment?: boolean;
  use_gasless?: boolean;
  auto_approve?: boolean;
  api_keys?: Record<string, string>;
  pipeline_id?: string;
  [key: string]: unknown;
}

export async function createWorkflow(
  body: CreateWorkflowBody,
  options?: FetchJsonOptions,
): Promise<{ workflow_id: string }> {
  return fetchJsonAuthed<{ workflow_id: string }>(ApiPaths.workflowsGenerate, {
    method: "POST",
    body: JSON.stringify(body),
    ...options,
  });
}

/**
 * Create a workflow with automatic x402 payment handling.
 *
 * When the orchestrator responds with a 402 + x402 challenge body, this
 * function builds a signed payment proof and retries the request with the
 * X-Payment header — matching the server contract in x402_middleware.py.
 *
 * Use this instead of createWorkflow when:
 * - x402 is enabled (isFeatureEnabled("x402"))
 * - A connected wallet is available for signing
 */
export async function createWorkflowWithX402(
  body: CreateWorkflowBody,
  wallet:
    | { address?: string; signMessage?: (msg: string) => Promise<string> }
    | null
    | undefined,
  options?: {
    maxPaymentUsd?: number;
    signal?: AbortSignal;
    /** When set, uses ERC-3009 / @x402/fetch (Kite-aligned x402) instead of EIP-191 receipts. */
    thirdwebAccount?: Account | null;
    /** Chain id for x402 registration (default SKALE Base Mainnet). */
    x402ChainId?: number;
  },
): Promise<{ workflow_id: string }> {
  const fetchWithPayment =
    options?.thirdwebAccount != null
      ? await createOfficialX402Fetch(
          options.thirdwebAccount,
          options.x402ChainId ?? 1187947933,
        )
      : createFetchWithPayment(wallet, options?.maxPaymentUsd);
  const base = getApiBase();
  const path = workflowsGeneratePath();

  let authHeaders: Record<string, string> = {};
  try {
    if (typeof window !== "undefined") {
      const session = getStoredSession();
      if (session?.access_token) {
        authHeaders = { Authorization: `Bearer ${session.access_token}` };
      }
    }
  } catch {
    // auth header is best-effort; server will reject with 401 if required
  }

  let res: Response;
  try {
    res = await fetchWithPayment(joinApiUrlForFetch(base, path), {
      method: "POST",
      credentials: "include",
      signal: options?.signal,
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = normalizeApiError(err);
    reportApiError(err, { path });
    throw new Error(msg);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const j = JSON.parse(errorText) as {
        message?: string;
        error?: string;
        detail?: string;
      };
      if (typeof j.message === "string") message = j.message;
      else if (typeof j.error === "string") message = j.error;
      else if (typeof j.detail === "string") message = j.detail;
    } catch {
      // keep default
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    reportApiError(err, { path, status: res.status });
    throw err;
  }

  return res.json() as Promise<{ workflow_id: string }>;
}

export async function getWorkflowStatus(
  workflowId: string,
): Promise<{ status: string }> {
  return fetchJsonAuthed(workflowStatusPath(workflowId));
}

export async function getStablecoins(): Promise<
  Record<string, { USDC?: string; USDT?: string }>
> {
  return fetchJsonAuthed<Record<string, { USDC?: string; USDT?: string }>>(
    ApiPaths.tokensStablecoins,
  ).catch((e) => {
    reportApiError(e, { path: ApiPaths.tokensStablecoins });
    return {};
  });
}

export async function testNetworkRpc(
  networkId: string,
  signal?: AbortSignal,
): Promise<{
  ok: boolean;
  block?: string;
  error?: string;
  latency_ms?: number;
}> {
  return fetchJsonAuthed(
    networksRpcTestPath(networkId),
    signal ? { signal } : undefined,
  );
}

export async function getNetworks(
  opts?: { skale?: boolean },
  signal?: AbortSignal,
): Promise<NetworkConfig[]> {
  const params = new URLSearchParams();
  if (opts?.skale) params.set("skale", "true");
  const path = params.toString()
    ? `${ApiPaths.networks}?${params}`
    : ApiPaths.networks;
  const data = await fetchJsonAuthed<
    { networks?: NetworkApiItem[] } | NetworkApiItem[]
  >(path, signal ? { signal } : undefined);
  const raw = Array.isArray(data) ? data : (data?.networks ?? []);
  return raw.map((n: NetworkApiItem) => ({
    id: n.network,
    network_id: n.network,
    name:
      n.name ??
      n.network.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    chain_id: n.chain_id,
    currency: n.currency,
    tier: n.tier,
    category: n.category,
    is_mainnet: n.is_mainnet,
  }));
}

export interface QuickDemoResponse {
  sandbox_id?: string;
  url?: string;
  status?: string;
}

export async function createQuickDemo(
  workflowId: string,
): Promise<QuickDemoResponse> {
  return fetchJsonAuthed(ApiPaths.quickDemo, {
    method: "POST",
    body: JSON.stringify({ workflow_id: workflowId }),
  });
}

export interface DebugSandboxResponse {
  sandbox_id?: string;
  url?: string;
  status?: string;
  workflow_id?: string;
}

export async function createDebugSandbox(
  workflowId: string,
): Promise<DebugSandboxResponse> {
  return fetchJsonAuthed(workflowDebugSandboxPath(workflowId), {
    method: "POST",
  });
}

export interface Metrics {
  [key: string]: unknown;
}

export async function getMetrics(
  params?: { time_range?: string },
  signal?: AbortSignal,
): Promise<Metrics> {
  const qs = params?.time_range
    ? `?time_range=${encodeURIComponent(params.time_range)}`
    : "";
  return fetchJsonAuthed(
    `${ApiPaths.metrics}${qs}`,
    signal ? { signal } : undefined,
  );
}

export interface SecurityFinding {
  id?: string;
  run_id?: string;
  tool?: string;
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
  location?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export async function getSecurityFindings(params?: {
  run_id?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ findings: SecurityFinding[] }> {
  const qs = new URLSearchParams();
  if (params?.run_id) qs.set("run_id", params.run_id);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const path = `${ApiPaths.securityFindings}${qs.toString() ? `?${qs}` : ""}`;
  return fetchJsonAuthed<{ findings: SecurityFinding[] }>(
    path,
    params?.signal ? { signal: params.signal } : undefined,
  ).catch((e) => {
    reportApiError(e, { path });
    return { findings: [] } as { findings: SecurityFinding[] };
  });
}

export async function getDetailedHealth(): Promise<{
  status: string;
  services?: Record<string, { status: string }>;
}> {
  return fetchJsonAuthed(ApiPaths.apiHealthDetailed);
}

export interface DomainRecord {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
}

export async function listDomains(): Promise<DomainRecord[]> {
  return fetchJsonAuthed<DomainRecord[]>(ApiPaths.infraDomains).catch((e) => {
    reportApiError(e, { path: ApiPaths.infraDomains });
    return [];
  });
}

export async function addDomain(domain: string): Promise<DomainRecord> {
  return fetchJsonAuthed(ApiPaths.infraDomains, {
    method: "POST",
    body: JSON.stringify({ domain }),
  });
}

export interface LogEntry {
  message?: string;
  level?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface LogsFilters {
  service?: string;
  host?: string;
  level?: string;
  page?: number;
  page_size?: number;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export async function getLogs(filters?: LogsFilters): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (filters?.page != null) params.set("page", String(filters.page));
  if (filters?.page_size != null)
    params.set("page_size", String(filters.page_size));
  const query = params.toString();
  const path = query ? `${ApiPaths.logs}?${query}` : ApiPaths.logs;
  return fetchJsonAuthed<LogsResponse>(path).catch((e) => {
    reportApiError(e, { path });
    return { logs: [], total: 0, page: 1, page_size: 50 } as LogsResponse;
  });
}

export async function getLogServices(): Promise<string[]> {
  return fetchJsonAuthed<string[]>(ApiPaths.logsServices).catch((e) => {
    reportApiError(e, { path: ApiPaths.logsServices });
    return [];
  });
}

export async function getLogHosts(): Promise<string[]> {
  return fetchJsonAuthed<string[]>(ApiPaths.logsHosts).catch((e) => {
    reportApiError(e, { path: ApiPaths.logsHosts });
    return [];
  });
}

export interface AgentStatus {
  name?: string;
  status?: string;
  step_index?: number;
  [key: string]: unknown;
}

export interface AgentsResponse {
  agents?: AgentStatus[];
}

export async function getAgents(): Promise<AgentsResponse> {
  return fetchJsonAuthed<AgentsResponse>(ApiPaths.agents).catch((e) => {
    reportApiError(e, { path: ApiPaths.agents });
    return { agents: [] } as AgentsResponse;
  });
}

export interface TemplateItem {
  id: string;
  name?: string;
  description?: string;
  source?: string;
  codegen_mode?: string;
  risk_profile?: string;
  requires_human_approval?: boolean;
  wizard_kind?: string;
  wizard_options?: unknown;
  [key: string]: unknown;
}

export async function getTemplates(): Promise<TemplateItem[]> {
  return fetchJsonAuthed<TemplateItem[]>(ApiPaths.templates).catch((e) => {
    reportApiError(e, { path: ApiPaths.templates });
    return [] as TemplateItem[];
  });
}

export async function searchTemplates(query: string): Promise<TemplateItem[]> {
  if (!query || !String(query).trim()) return getTemplates();
  const qs = new URLSearchParams({ q: String(query).trim() });
  return fetchJsonAuthed<TemplateItem[]>(
    `${ApiPaths.templatesSearch}?${qs}`,
  ).catch((e) => {
    reportApiError(e, { path: ApiPaths.templatesSearch });
    return [] as TemplateItem[];
  });
}

export async function getWorkflowContracts(
  workflowId: string,
): Promise<{ bytecode?: string; abi?: unknown; [key: string]: unknown }[]> {
  return fetchJsonAuthed(workflowContractsPath(workflowId));
}

export async function getWorkflowDeployments(workflowId: string): Promise<{
  deployments?: {
    contract_address?: string;
    network?: string;
    [key: string]: unknown;
  }[];
}> {
  return fetchJsonAuthed<{
    deployments?: {
      contract_address?: string;
      network?: string;
      [key: string]: unknown;
    }[];
  }>(workflowDeploymentsPath(workflowId)).catch((e) => {
    reportApiError(e, { path: workflowDeploymentsPath(workflowId) });
    return { deployments: [] };
  });
}

export interface ClarificationEntry {
  message: string;
  at: string;
}

export interface ClarifyResponse {
  workflow_id: string;
  accepted: boolean;
  clarifications: ClarificationEntry[];
}

export async function submitClarification(
  workflowId: string,
  body: { message: string },
): Promise<ClarifyResponse> {
  return fetchJsonAuthed(workflowClarifyPath(workflowId), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function cancelWorkflow(workflowId: string): Promise<unknown> {
  return fetchJsonAuthed(workflowCancelPath(workflowId), {
    method: "POST",
  });
}

export function getAgentDiscussionStreamUrl(workflowId: string): string {
  return joinApiUrlForFetch(
    getApiBase(),
    workflowDiscussionStreamPath(workflowId),
  );
}

export async function getWorkflowUiSchema(
  workflowId: string,
): Promise<{ workflow_id: string; ui_schema: unknown }> {
  return fetchJsonAuthed(workflowUiSchemaPath(workflowId));
}

export async function generateWorkflowUiSchema(
  workflowId: string,
): Promise<{ workflow_id: string; ui_schema: unknown }> {
  return fetchJsonAuthed(workflowUiSchemaGeneratePath(workflowId), {
    method: "POST",
  });
}

export interface ExportUiAppResponse {
  workflow_id: string;
  ui_schema: unknown;
  template: string;
  message?: string;
  zip_base64?: string;
  filename?: string;
}

export async function exportUiApp(
  workflowId: string,
  template?: string,
): Promise<ExportUiAppResponse> {
  return fetchJsonAuthed(workflowUiAppsExportPath(workflowId), {
    method: "POST",
    body: JSON.stringify({ template: template || "hyperagent-default" }),
  });
}

export function downloadExportedZip(res: ExportUiAppResponse): void {
  if (!res.zip_base64 || !res.filename || typeof window === "undefined") return;
  try {
    const bin = atob(res.zip_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // no-op
  }
}

export async function contractRead(body: {
  contract_address: string;
  network?: string;
  chain_id?: number;
  function_name: string;
  function_args?: unknown[];
  abi: unknown[];
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  return fetchJsonAuthed(ApiPaths.contractsRead, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function contractCall(body: {
  contract_address: string;
  network?: string;
  chain_id?: number;
  function_name: string;
  function_args?: unknown[];
  abi: unknown[];
  caller_address?: string;
  value?: string;
  gas_limit?: number;
}): Promise<{
  success: boolean;
  transaction?: Record<string, unknown>;
  message?: string;
  error?: string;
}> {
  return fetchJsonAuthed(ApiPaths.contractsCall, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function quarantineWorkflow(
  workflowId: string,
  body: { reason?: string },
): Promise<{ workflow_id: string; status: string }> {
  return fetchJsonAuthed(workflowQuarantinePath(workflowId), {
    method: "POST",
    body: JSON.stringify({ reason: body.reason ?? "" }),
  });
}

export async function rollbackWorkflow(
  workflowId: string,
  body: { reason?: string },
): Promise<{ workflow_id: string; status: string }> {
  return fetchJsonAuthed(workflowRollbackPath(workflowId), {
    method: "POST",
    body: JSON.stringify({ reason: body.reason ?? "" }),
  });
}

export async function retryWorkflow(
  workflowId: string,
): Promise<{ workflow_id: string; status: string }> {
  return fetchJsonAuthed(workflowRetryPath(workflowId), {
    method: "POST",
  });
}
