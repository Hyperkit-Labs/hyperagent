/**
 * Backend API client. All functions call the HyperAgent backend (gateway at NEXT_PUBLIC_API_URL).
 * getApiBase() is the single source of truth for the backend base URL; use it in API routes
 * (e.g. app/api/chat, app/api/streaming) when calling the backend from the server.
 */

import { getServiceUrl } from '@/config/environment';
import { FALLBACK_DEFAULT_NETWORK_ID, FALLBACK_DEFAULT_CHAIN_ID } from '@/constants/defaults';
import type { Workflow } from '@/lib/types';
import { getStoredSession } from '@/lib/session-store';

export const getApiBase = (): string => getServiceUrl('backend').replace(/\/$/, '');
const base = () => getApiBase();

/** URL for API reference (Swagger UI). Use NEXT_PUBLIC_DOCS_URL when set (e.g. http://localhost:8000/docs for orchestrator direct); else origin from getApiBase() + /docs (gateway proxies /docs to orchestrator). */
export const getDocsUrl = (): string => {
  const env = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DOCS_URL;
  const url = (env && typeof env === 'string' ? env.trim() : '') || '';
  if (url) return url.replace(/\/$/, '');
  const apiBase = getApiBase();
  const root = apiBase.replace(/\/api\/v1\/?$/, '');
  return root ? `${root}/docs` : `${apiBase}/../docs`;
};

export interface WorkflowResponse {
  workflows: Workflow[];
}

export interface NetworkConfig {
  id: string;
  network_id: string;
  name?: string;
  chain_id?: number;
  currency?: string;
  /** From registry network/chains.yaml hyperagent.tier */
  tier?: string;
  /** From registry network/chains.yaml hyperagent.category (e.g. testnet, L1, L2) */
  category?: string;
  /** True for mainnet; false for testnet. */
  is_mainnet?: boolean;
}

export interface PaymentHistoryItem {
  id?: string;
  amount?: string;
  currency?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface PaymentHistoryResponse {
  items?: PaymentHistoryItem[];
  total?: number;
}

export interface PaymentSummary {
  total?: string;
  currency?: string;
  [key: string]: unknown;
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

export interface AgentStatus {
  name?: string;
  status?: string;
  step_index?: number;
  [key: string]: unknown;
}

export interface AgentsResponse {
  agents?: AgentStatus[];
}

export interface SpendingControlWithBudget {
  budget?: string;
  spent?: string;
  currency?: string;
  period?: string;
  alert_threshold_percent?: number;
  [key: string]: unknown;
}

export interface Metrics {
  [key: string]: unknown;
}

/** Request timeout (ms). Fail fast so UI does not hang when backend is down. */
const API_REQUEST_TIMEOUT_MS = 10000;

/** Longer timeout for BYOK (Settings llm-keys) so gateway/orchestrator cold start does not show as timeout. */
const BYOK_REQUEST_TIMEOUT_MS = 20000;

/** User-facing message for network/backend failures. */
export const API_UNREACHABLE_MESSAGE = 'Backend unreachable. Check that the API is running and NEXT_PUBLIC_API_URL is correct.';

/** Message shown on 401 so UI can show sign-in CTA instead of generic timeout. */
export const AUTH_ERROR_MESSAGE = 'Session expired or not signed in. Please sign in again.';

/**
 * Optional provider for auth headers (Authorization: Bearer <our JWT>).
 * When null, fetchJson falls back to session store (SIWE-issued token). Gateway validates with AUTH_JWT_SECRET.
 */
type AuthHeaderProvider = () => Promise<Record<string, string>>;
let authHeaderProvider: AuthHeaderProvider | null = null;

export function setAuthHeaderProvider(provider: AuthHeaderProvider | null): void {
  authHeaderProvider = provider;
}

/** Optional callback when a 401 is received (e.g. clear session and show toast). Called before the error is thrown. */
type On401Callback = () => void;
let on401Callback: On401Callback | null = null;

export function setOn401Callback(callback: On401Callback | null): void {
  on401Callback = callback;
}

/** Use in catch blocks: narrows unknown and avoids err.message on non-Error. */
export function isAbortError(error: unknown): error is Error & { name: 'AbortError' } {
  return error instanceof Error && error.name === 'AbortError';
}

/** Safe message from catch(err: unknown). Replaces generic SDK errors with a useful fallback. */
export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const GENERIC = [
    'an error occurred.',
    'an error occurred',
    'something went wrong',
    'failed to fetch',
  ];
  function isGeneric(s: string): boolean {
    const lower = s.toLowerCase();
    return GENERIC.some((g) => lower === g || lower.startsWith(g));
  }

  if (error instanceof Error) {
    const msg = error.message?.trim() || '';
    if (!msg || isGeneric(msg)) return fallback;
    return msg;
  }
  if (typeof error === 'string') {
    const s = (error as string).trim();
    if (!s || isGeneric(s)) return fallback;
    return s;
  }
  return fallback;
}

/** Error with optional HTTP status from API (fetchJson attaches status on 4xx/5xx). */
export interface ApiErrorWithStatus extends Error {
  status?: number;
}

/** Options for normalizeApiError when the abort source is known (e.g. from fetchJson). */
export interface NormalizeApiErrorOptions {
  /** True when the request was aborted by the internal timeout (no caller signal). */
  wasTimeout?: boolean;
  /** HTTP status when available (e.g. from fetchJson). Used to show auth message for 401. */
  status?: number;
}

/** Normalize fetch/API errors to a single user-facing message. For 401, returns AUTH_ERROR_MESSAGE so UI can show sign-in. */
export function normalizeApiError(error: unknown, opts?: NormalizeApiErrorOptions): string {
  const status = opts?.status ?? (error as ApiErrorWithStatus)?.status;
  if (status === 401) return AUTH_ERROR_MESSAGE;

  if (error instanceof Error) {
    if (isAbortError(error)) {
      return opts?.wasTimeout
        ? 'Backend request timed out. Ensure the API is running and NEXT_PUBLIC_API_URL (or backend) is reachable.'
        : 'Request was cancelled.';
    }
    if (error instanceof TypeError || error.message === 'Failed to fetch') return API_UNREACHABLE_MESSAGE;
    return error.message;
  }
  if (typeof error === 'string') return error;
  return 'Request failed. Please try again.';
}

/** Report API errors for observability. Call from fetchJson so all routes are covered. Skips AbortError (unmount/refetch) and network errors for /config to avoid console noise when backend is down on login. */
export function reportApiError(error: unknown, context: { path?: string; [key: string]: unknown }): void {
  if (isAbortError(error)) return;
  const path = context?.path;
  const isNetworkError = error instanceof TypeError && (error.message === 'Failed to fetch' || error.message === 'Load failed');
  if (path === '/config' && isNetworkError) return;
  const msg = error instanceof Error ? error.message : String(error);
  if (typeof console !== 'undefined' && console.error) {
    console.error('[API]', msg, context);
  }
}

/** Options for fetchJson. RequestInit plus optional request timeout (ms). */
export interface FetchJsonOptions extends RequestInit {
  /** Override default request timeout (ms). Used e.g. for BYOK llm-keys. */
  timeoutMs?: number;
}

let _apiBaseLogged = false;

/** All backend calls send cookies when same-origin or CORS allows credentials. */
async function fetchJson<T>(path: string, options?: FetchJsonOptions): Promise<T> {
  const { timeoutMs, ...init } = options ?? {};
  const timeout = timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  let lastError: Error | null = null;

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development' && !_apiBaseLogged) {
    _apiBaseLogged = true;
    console.log('[API] base=', base(), 'path=', path);
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let authHeaders: Record<string, string> = {};
      try {
        if (authHeaderProvider) {
          authHeaders = await authHeaderProvider();
        } else if (typeof window !== 'undefined') {
          const session = getStoredSession();
          if (session?.access_token) {
            authHeaders = { Authorization: `Bearer ${session.access_token}` };
          }
        }
      } catch {
        // Ignore so requests still work when session is unavailable
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(`${base()}${path}`, {
        ...init,
        signal: init.signal ?? controller.signal,
        credentials: 'include',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          ...(options?.headers as Record<string, string>),
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => res.statusText);
        let message = errorText || `HTTP ${res.status}: ${res.statusText}`;
        try {
          const j = JSON.parse(errorText) as { message?: string; error?: string; detail?: string | Array<{ msg?: string }> };
          if (typeof j.message === 'string') message = j.message;
          else if (typeof j.error === 'string') message = j.error;
          else if (typeof j.detail === 'string') message = j.detail;
          else if (Array.isArray(j.detail) && j.detail.length > 0 && typeof j.detail[0]?.msg === 'string') message = j.detail[0].msg;
        } catch {
          // keep message as errorText
        }
        const error = new Error(message) as ApiErrorWithStatus;
        error.status = res.status;
        const requestId = res.headers.get('X-Request-Id') ?? res.headers.get('x-request-id')
          ?? (() => { try { const j = JSON.parse(errorText); return (j as { requestId?: string }).requestId ?? (j as { request_id?: string }).request_id; } catch { return undefined; } })();
        if (requestId) (error as Error & { requestId?: string }).requestId = requestId;
        if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
          console.warn(`[API] ${path} → ${res.status}`, message.slice(0, 80));
        }
        // Don't retry on client errors (4xx) except 408, 429
        if (res.status >= 400 && res.status < 500 && ![408, 429].includes(res.status)) {
          if (res.status === 401 && on401Callback) {
            try {
              on401Callback();
            } catch {
              // ignore so error still propagates
            }
          }
          reportApiError(error, { path, status: res.status });
          throw error;
        }

        // Retry on server errors (5xx) and specific client errors
        if (attempt < maxRetries - 1) {
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }

        reportApiError(error, { path, status: res.status });
        throw error;
      }

      return res.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined' && !init.signal) {
          console.warn(`[API] ${path} → timeout after ${timeout}ms`);
        }
        throw error;
      }

      // Network errors: retry
      if (attempt < maxRetries - 1 && error instanceof TypeError) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      const normalized = new Error(normalizeApiError(error));
      reportApiError(error, { path });
      throw normalized;
    }
  }

  const final = lastError ? new Error(normalizeApiError(lastError)) : new Error('Request failed after retries');
  reportApiError(lastError ?? final, { path });
  throw final;
}

/** Default target network when list not available (testnet slug from registry). */
export const DEFAULT_NETWORK = FALLBACK_DEFAULT_NETWORK_ID;

/** Normalize API errors to a user-facing message. Use in hooks and pages. */
export function handleApiError(error: unknown): string {
  return normalizeApiError(error);
}

/** True when the normalized message is the auth/session message (401). Use to show sign-in CTA. */
export function isAuthError(message: string): boolean {
  return message === AUTH_ERROR_MESSAGE || message.includes('401') || message.includes('Unauthorized');
}

export async function getWorkflows(
  params?: { limit?: number; status?: string },
  signal?: AbortSignal
): Promise<WorkflowResponse> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.status) q.set('status', params.status);
  const query = q.toString();
  return fetchJson(`/workflows${query ? `?${query}` : ''}`, { signal });
}

export async function getWorkflow(workflowId: string): Promise<Workflow> {
  return fetchJson(`/workflows/${workflowId}`);
}

export interface PresetItem {
  id: string;
  name?: string;
  description?: string;
  chain?: string;
  [key: string]: unknown;
}

export async function getPresets(): Promise<PresetItem[]> {
  return fetchJson<PresetItem[]>('/presets').catch(() => []);
}

export interface BlueprintItem {
  id: string;
  name?: string;
  description?: string;
  chain?: string;
  [key: string]: unknown;
}

export async function getBlueprints(): Promise<BlueprintItem[]> {
  return fetchJson<BlueprintItem[]>('/blueprints').catch(() => []);
}

export interface RunDetail {
  id: string;
  workflow_id?: string;
  status?: string;
  [key: string]: unknown;
}

export async function getRun(runId: string): Promise<RunDetail> {
  return fetchJson<RunDetail>(`/runs/${runId}`);
}

export interface RunStep {
  step_type?: string;
  status?: string;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

export async function getRunSteps(runId: string): Promise<{ run_id: string; steps: RunStep[] }> {
  return fetchJson<{ run_id: string; steps: RunStep[] }>(`/runs/${runId}/steps`);
}

/** Approve spec and resume pipeline from design. Call when workflow is at spec_review with spec present. */
export async function approveSpec(runId: string): Promise<{ run_id: string; status: string; current_stage: string; message?: string }> {
  return fetchJson<{ run_id: string; status: string; current_stage: string; message?: string }>(`/runs/${runId}/approve_spec`, { method: 'PATCH' });
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
  options?: FetchJsonOptions
): Promise<{ workflow_id: string }> {
  return fetchJson<{ workflow_id: string }>('/workflows/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
}

export async function getWorkflowStatus(workflowId: string): Promise<{ status: string }> {
  return fetchJson(`/workflows/${workflowId}/status`);
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

export interface IntegrationsStatus {
  tenderly_configured?: boolean;
  pinata_configured?: boolean;
  qdrant_configured?: boolean;
}

export interface RuntimeConfig {
  x402_enabled: boolean;
  monitoring_enabled?: boolean;
  merchant_wallet_address?: string | null;
  credits_enabled?: boolean;
  /** Credits granted per 1 USD (e.g. 10 means $1 = 10 credits). Default 10. */
  credits_per_usd?: number;
  /** Credits consumed per workflow run. Default 7. */
  credits_per_run?: number;
  integrations?: IntegrationsStatus;
  /** Default network slug from registry (e.g. skalebase-sepolia). */
  default_network_id?: string;
  /** Default chain ID from registry (e.g. 324705682). */
  default_chain_id?: number;
  /** A2A agent ID from ERC-8004 registry. */
  a2a_agent_id?: string | null;
  /** A2A default chain ID. */
  a2a_default_chain_id?: number | null;
  /** A2A agent identity (address, chainId, etc.). */
  a2a_identity?: Record<string, unknown> | null;
}

export async function getConfig(): Promise<RuntimeConfig> {
  return fetchJson<RuntimeConfig>('/config').catch(() => ({
    x402_enabled: false,
    monitoring_enabled: false,
    merchant_wallet_address: null,
    credits_enabled: false,
    integrations: { tenderly_configured: false, pinata_configured: false, qdrant_configured: false },
    default_network_id: FALLBACK_DEFAULT_NETWORK_ID,
    default_chain_id: FALLBACK_DEFAULT_CHAIN_ID,
  }));
}

/**
 * GET /networks. Returns list from chain registry (backend normalizes to NetworkConfig[]).
 * Raw API may return { networks: [...] } or array; this function always returns NetworkConfig[].
 */
/** GET /tokens/stablecoins. Returns { chainId: { USDC: addr, USDT: addr } }. */
export async function getStablecoins(): Promise<Record<string, { USDC?: string; USDT?: string }>> {
  return fetchJson<Record<string, { USDC?: string; USDT?: string }>>('/tokens/stablecoins').catch(() => ({}));
}

/**
 * GET /networks. Returns list from chain registry (backend normalizes to NetworkConfig[]).
 * Raw API may return { networks: [...] } or array; this function always returns NetworkConfig[].
 */
export async function getNetworks(
  opts?: { skale?: boolean },
  signal?: AbortSignal
): Promise<NetworkConfig[]> {
  const params = new URLSearchParams();
  if (opts?.skale) params.set('skale', 'true');
  const path = params.toString() ? `/networks?${params}` : '/networks';
  const data = await fetchJson<{ networks?: NetworkApiItem[] } | NetworkApiItem[]>(
    path,
    signal ? { signal } : undefined
  );
  const raw = Array.isArray(data) ? data : (data?.networks ?? []);
  return raw.map((n: NetworkApiItem) => ({
    id: n.network,
    network_id: n.network,
    name: n.name ?? n.network.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
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

export async function createQuickDemo(): Promise<QuickDemoResponse> {
  return fetchJson<QuickDemoResponse>('/quick-demo', { method: 'POST' });
}

export async function getMetrics(signal?: AbortSignal): Promise<Metrics> {
  return fetchJson('/metrics', signal ? { signal } : undefined);
}

export async function getDetailedHealth(): Promise<{ status: string; services?: Record<string, { status: string }> }> {
  return fetchJson('/health/detailed');
}

export async function getPaymentHistory(params?: { limit?: number; offset?: number }): Promise<PaymentHistoryResponse> {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return fetchJson<PaymentHistoryResponse>(`/payments/history?${qs}`).catch(() => ({ items: [], total: 0 }));
}

export async function getPaymentSummary(): Promise<PaymentSummary> {
  return fetchJson<PaymentSummary>('/payments/summary').catch(() => ({}));
}

export async function getSpendingControlWithBudget(): Promise<SpendingControlWithBudget> {
  return fetchJson<SpendingControlWithBudget>('/payments/spending-control').catch(() => ({}));
}

export interface SpendingControlPatchBody {
  budget_amount: number;
  budget_currency?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  alert_threshold_percent?: number;
}

export async function patchSpendingControl(body: SpendingControlPatchBody): Promise<SpendingControlWithBudget> {
  return fetchJson<SpendingControlWithBudget>('/payments/spending-control', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface CreditsBalance {
  balance: number;
  currency: string;
  user_id?: string;
  message?: string;
}

export async function getCreditsBalance(): Promise<CreditsBalance> {
  return fetchJson<CreditsBalance>('/credits/balance').catch(() => ({ balance: 0, currency: 'USD' }));
}

export interface CreditsTopUpBody {
  amount: number;
  currency?: string;
  reference_id?: string;
  reference_type?: string;
}

export async function topUpCredits(body: CreditsTopUpBody): Promise<CreditsBalance & { user_id?: string }> {
  return fetchJson<CreditsBalance & { user_id?: string }>('/credits/top-up', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Top up credits after on-chain USDC/USDT transfer. reference_id should be tx_hash for audit. */
export async function topUpCreditsWithTx(body: CreditsTopUpBody & { tx_hash?: string }): Promise<CreditsBalance & { user_id?: string }> {
  return topUpCredits({
    ...body,
    reference_id: body.reference_id ?? body.tx_hash,
    reference_type: body.reference_type ?? (body.tx_hash ? 'usdc_transfer' : 'manual'),
  });
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export async function getLogs(filters?: LogsFilters): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (filters?.page != null) params.set('page', String(filters.page));
  if (filters?.page_size != null) params.set('page_size', String(filters.page_size));
  const query = params.toString();
  const path = query ? `/logs?${query}` : '/logs';
  return fetchJson<LogsResponse>(path).catch(() => ({
    logs: [],
    total: 0,
    page: 1,
    page_size: 50,
  }));
}

export async function getLogServices(): Promise<string[]> {
  return fetchJson<string[]>('/logs/services').catch(() => []);
}

export async function getLogHosts(): Promise<string[]> {
  return fetchJson<string[]>('/logs/hosts').catch(() => []);
}

export async function getAgents(): Promise<AgentsResponse> {
  return fetchJson<AgentsResponse>('/agents').catch(() => ({ agents: [] }));
}

/** Template from registry (GET /api/v1/templates). Matches orchestrator get_templates_for_api(). */
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
  return fetchJson<TemplateItem[]>('/templates').catch(() => []);
}

export async function searchTemplates(query: string): Promise<TemplateItem[]> {
  if (!query || !String(query).trim()) return getTemplates();
  const qs = new URLSearchParams({ q: String(query).trim() });
  return fetchJson<TemplateItem[]>(`/templates/search?${qs}`).catch(() => []);
}

export interface PrepareDeployParams {
  chainId?: number;
  mainnet_confirm?: boolean;
}

export async function prepareDeploymentTransaction(
  workflowId: string,
  params?: PrepareDeployParams
): Promise<unknown> {
  const chainId = params?.chainId ?? FALLBACK_DEFAULT_CHAIN_ID;
  const mainnet_confirm = params?.mainnet_confirm ?? false;
  const qs = new URLSearchParams({ chain_id: String(chainId) });
  return fetchJson(`/workflows/${workflowId}/deploy/prepare?${qs}`, {
    method: 'POST',
    body: JSON.stringify({ mainnet_confirm }),
  });
}

export async function completeDeployment(
  workflowId: string,
  body: { contractAddress: string; transactionHash: string; walletAddress: string; abi?: unknown[]; chainId?: number }
): Promise<unknown> {
  return fetchJson(`/workflows/${workflowId}/deploy/complete`, { method: 'POST', body: JSON.stringify(body) });
}

export async function getWorkflowContracts(workflowId: string): Promise<{ bytecode?: string; abi?: unknown; [key: string]: unknown }[]> {
  return fetchJson(`/workflows/${workflowId}/contracts`);
}

export async function getWorkflowDeployments(workflowId: string): Promise<{ deployments?: { contract_address?: string; network?: string; [key: string]: unknown }[] }> {
  return fetchJson<{ deployments?: { contract_address?: string; network?: string; [key: string]: unknown }[] }>(`/workflows/${workflowId}/deployments`).catch(() => ({ deployments: [] }));
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

export async function submitClarification(workflowId: string, body: { message: string }): Promise<ClarifyResponse> {
  return fetchJson<ClarifyResponse>(`/workflows/${workflowId}/clarify`, { method: 'POST', body: JSON.stringify(body) });
}

export async function cancelWorkflow(workflowId: string): Promise<unknown> {
  return fetchJson(`/workflows/${workflowId}/cancel`, { method: 'POST' });
}

export function getAgentDiscussionStreamUrl(workflowId: string): string {
  return `${getApiBase()}/streaming/workflows/${workflowId}/discussion`;
}

/** UI schema for contract interaction (chain-agnostic). */
export async function getWorkflowUiSchema(workflowId: string): Promise<{ workflow_id: string; ui_schema: unknown }> {
  return fetchJson<{ workflow_id: string; ui_schema: unknown }>(`/workflows/${workflowId}/ui-schema`);
}

/** Generate UI schema from first deployment + ABI; store and return. */
export async function generateWorkflowUiSchema(workflowId: string): Promise<{ workflow_id: string; ui_schema: unknown }> {
  return fetchJson<{ workflow_id: string; ui_schema: unknown }>(`/workflows/${workflowId}/ui-schema/generate`, { method: 'POST' });
}

export interface ExportUiAppResponse {
  workflow_id: string;
  ui_schema: unknown;
  template: string;
  message?: string;
  zip_base64?: string;
  filename?: string;
}

/** Export mini app for workflow UI schema. Returns schema and optional zip_base64 + filename for download. */
export async function exportUiApp(workflowId: string, template?: string): Promise<ExportUiAppResponse> {
  return fetchJson<ExportUiAppResponse>(
    `/workflows/${workflowId}/ui-apps/export`,
    { method: 'POST', body: JSON.stringify({ template: template || 'hyperagent-default' }) }
  );
}

/** Trigger browser download of exported zip from exportUiApp response. Call when zip_base64 and filename are present. */
export function downloadExportedZip(res: ExportUiAppResponse): void {
  if (!res.zip_base64 || !res.filename || typeof window === 'undefined') return;
  try {
    const bin = atob(res.zip_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // no-op if download fails
  }
}

/** User-facing message when workflow is started without LLM keys (422 from backend or pre-check). */
export const LLM_KEYS_REQUIRED_MESSAGE = 'Add LLM API keys in Settings to run the pipeline.';

/** Shown when backend returns BYOK storage or KMS migration error; prompts user to save keys again. */
export const BYOK_SAVE_AGAIN_HINT = 'Enter your keys and click Save again to complete.';

/** True when the API error indicates BYOK storage failure or KMS migration (503 or message about re-save/migrate). */
export function isByokStorageOrMigrationError(message: string): boolean {
  if (!message || typeof message !== 'string') return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('byok storage') ||
    lower.includes('re-save llm keys') ||
    lower.includes('migrate to kms') ||
    lower.includes('llm_key_encryption_key') ||
    lower.includes('llm_key_kms')
  );
}

/** Message when POST llm-keys is rate limited (429 from gateway). */
export const BYOK_RATE_LIMIT_MESSAGE = 'LLM keys save rate limit reached. Wait a minute and try again.';

/** BYOK: which LLM providers are configured for the current workspace (no key values). Persisted in DB when NEXT_PUBLIC_API_URL points at the gateway (gateway sets X-User-Id from JWT). Keys are encrypted at rest (Fernet or KMS envelope). */
const workspaceHeaders = (workspaceId?: string): Record<string, string> =>
  workspaceId ? { 'X-Workspace-Id': workspaceId } : {};

export async function getConfiguredLLMProviders(workspaceId?: string): Promise<{ configured_providers: string[] }> {
  return fetchJson<{ configured_providers: string[] }>('/workspaces/current/llm-keys', {
    credentials: 'include',
    headers: workspaceHeaders(workspaceId),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

/** Check if at least one LLM provider is configured before starting a workflow. Use before createWorkflow to avoid 422. */
export async function requireLLMKeys(workspaceId?: string): Promise<{ ok: boolean }> {
  try {
    const { configured_providers } = await getConfiguredLLMProviders(workspaceId);
    return { ok: Array.isArray(configured_providers) && configured_providers.length > 0 };
  } catch {
    return { ok: false };
  }
}

/** BYOK: store LLM keys for the current workspace. Keys are encrypted at rest (Fernet or KMS envelope). */
export async function setLLMKeys(keys: Record<string, string>, workspaceId?: string): Promise<{ configured_providers: string[] }> {
  return fetchJson<{ configured_providers: string[] }>('/workspaces/current/llm-keys', {
    method: 'POST',
    headers: workspaceHeaders(workspaceId),
    body: JSON.stringify({ keys }),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

/** BYOK: remove all LLM keys for the current workspace. */
export async function deleteLLMKeys(workspaceId?: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>('/workspaces/current/llm-keys', {
    method: 'DELETE',
    headers: workspaceHeaders(workspaceId),
    timeoutMs: BYOK_REQUEST_TIMEOUT_MS,
  });
}

/** Contract read (view/pure). Backend: POST /contracts/read. Requires chain_id or network and abi. */
export async function contractRead(body: {
  contract_address: string;
  network?: string;
  chain_id?: number;
  function_name: string;
  function_args?: unknown[];
  abi: unknown[];
}): Promise<{ success: boolean; result?: unknown; error?: string }> {
  return fetchJson<{ success: boolean; result?: unknown; error?: string }>('/contracts/read', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Contract write (build unsigned tx for user to sign). Backend: POST /contracts/call. Requires chain_id or network and abi. */
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
}): Promise<{ success: boolean; transaction?: Record<string, unknown>; message?: string; error?: string }> {
  return fetchJson<{ success: boolean; transaction?: Record<string, unknown>; message?: string; error?: string }>('/contracts/call', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}


export interface PricingPlan {
  id: string;
  name: string;
  limits: Record<string, number>;
  enabledPipelines: string[];
  features: string[];
}

export interface PricingResource {
  id: string;
  name: string;
  unit: string;
  description: string;
  unit_price: number;
}

export interface UsageSummary {
  plan: string;
  plan_name: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
  features: string[];
  enabled_pipelines: string[];
}

export async function getPricingPlans(): Promise<{ plans: PricingPlan[] }> {
  return fetchJson<{ plans: PricingPlan[] }>('/pricing/plans');
}

export async function getPricingResources(): Promise<{ resources: PricingResource[] }> {
  return fetchJson<{ resources: PricingResource[] }>('/pricing/resources');
}

export async function getPricingUsage(): Promise<UsageSummary> {
  return fetchJson<UsageSummary>('/pricing/usage');
}
