/**
 * Single source of truth for gateway + Studio API path strings.
 * Gateway routers, metering, x402, rate limits, and Studio fetch paths should import from here.
 */

export const API_V1 = "/api/v1";

/** CAIP-2 for SKALE Base Mainnet (x402 / billing). */
export const SKALE_BASE_MAINNET_CAIP = "eip155:1187947933";

/** Versioned paths as served by the orchestrator (after gateway prefix restore). */
export const ApiPaths = {
  root: "/",
  health: "/health",
  healthLive: "/health/live",
  apiHealth: `${API_V1}/health`,
  apiHealthLive: `${API_V1}/health/live`,
  apiHealthDetailed: `${API_V1}/health/detailed`,
  authBootstrap: `${API_V1}/auth/bootstrap`,
  config: `${API_V1}/config`,
  configIntegrationsDebug: `${API_V1}/config/integrations-debug`,
  networks: `${API_V1}/networks`,
  tokensStablecoins: `${API_V1}/tokens/stablecoins`,
  platformTrackRecord: `${API_V1}/platform/track-record`,
  presets: `${API_V1}/presets`,
  blueprints: `${API_V1}/blueprints`,
  templates: `${API_V1}/templates`,
  templatesSearch: `${API_V1}/templates/search`,
  workflows: `${API_V1}/workflows`,
  workflowsGenerate: `${API_V1}/workflows/generate`,
  agents: `${API_V1}/agents`,
  logs: `${API_V1}/logs`,
  logsServices: `${API_V1}/logs/services`,
  logsHosts: `${API_V1}/logs/hosts`,
  metrics: `${API_V1}/metrics`,
  securityFindings: `${API_V1}/security/findings`,
  quickDemo: `${API_V1}/quick-demo`,
  infraDomains: `${API_V1}/infra/domains`,
  contractsRead: `${API_V1}/contracts/read`,
  contractsCall: `${API_V1}/contracts/call`,
  workspacesCurrentLlmKeys: `${API_V1}/workspaces/current/llm-keys`,
  workspacesCurrentLlmKeysValidate: `${API_V1}/workspaces/current/llm-keys/validate`,
  creditsBalance: `${API_V1}/credits/balance`,
  creditsTopUp: `${API_V1}/credits/top-up`,
  paymentsSummary: `${API_V1}/payments/summary`,
  paymentsHistory: `${API_V1}/payments/history`,
  paymentsSpendingControl: `${API_V1}/payments/spending-control`,
  pricingPlans: `${API_V1}/pricing/plans`,
  pricingResources: `${API_V1}/pricing/resources`,
  pricingUsage: `${API_V1}/pricing/usage`,
  agentRegistryAgents: `${API_V1}/agent-registry/agents`,
  agentRegistryCapabilities: `${API_V1}/agent-registry/capabilities`,
  a2aTasks: `${API_V1}/a2a/tasks`,
  erc8004Sync: `${API_V1}/erc8004/sync`,
  erc8004Agents: `${API_V1}/erc8004/agents`,
  userTemplates: `${API_V1}/user-templates`,
  artifacts: `${API_V1}/artifacts`,
  byokPrefix: `${API_V1}/byok`,
  storageWebhooksPrefix: `${API_V1}/storage/webhooks`,
  creditsPrefix: `${API_V1}/credits`,
  paymentsPrefix: `${API_V1}/payments`,
  pricingPrefix: `${API_V1}/pricing`,
  identityPrefix: `${API_V1}/identity`,
  deploy: `${API_V1}/deploy`,
  compile: `${API_V1}/compile`,
  audit: `${API_V1}/audit`,
} as const;

/** First path segment after host for legacy gateway mounts (no `/api/v1`). */
export const GatewayLegacyMountPaths = {
  config: "/config",
  platformTrackRecord: "/platform/track-record",
  networks: "/networks",
  tokensStablecoins: "/tokens/stablecoins",
  workspaces: "/workspaces",
  workflows: "/workflows",
  integrationsDebugConfig: "/config/integrations-debug",
} as const;

/** Paths treated as public by the gateway auth middleware (normalized, no query). */
export const GATEWAY_PUBLIC_PATHS = [
  ApiPaths.root,
  ApiPaths.health,
  ApiPaths.healthLive,
  ApiPaths.apiHealth,
  ApiPaths.apiHealthLive,
  "/auth/bootstrap",
  ApiPaths.authBootstrap,
  ApiPaths.config,
  GatewayLegacyMountPaths.config,
  ApiPaths.networks,
  ApiPaths.tokensStablecoins,
  ApiPaths.platformTrackRecord,
  GatewayLegacyMountPaths.platformTrackRecord,
  GatewayLegacyMountPaths.networks,
  "/tokens/stablecoins",
] as const;

export const GATEWAY_DEV_ONLY_PUBLIC_PATHS = [
  ApiPaths.configIntegrationsDebug,
  GatewayLegacyMountPaths.integrationsDebugConfig,
] as const;

/** Prefixes exempt from metering / credit preflight. */
export const METERING_EXEMPT_PREFIXES = [
  ApiPaths.authBootstrap,
  "/auth/bootstrap",
  ApiPaths.creditsPrefix,
  ApiPaths.paymentsPrefix,
  ApiPaths.pricingPrefix,
  ApiPaths.byokPrefix,
  ApiPaths.config,
  GatewayLegacyMountPaths.config,
  ApiPaths.networks,
  ApiPaths.tokensStablecoins,
  "/networks",
  "/tokens/stablecoins",
  "/tokens",
  ApiPaths.platformTrackRecord,
  GatewayLegacyMountPaths.platformTrackRecord,
  `${API_V1}/identity`,
  ApiPaths.apiHealth,
  ApiPaths.workspacesCurrentLlmKeys,
  "/workspaces/current/llm-keys",
  ApiPaths.storageWebhooksPrefix,
] as const;

/** x402 priced routes: path key → must match normalizePath on gateway. */
export const X402_PRICED_PATHS: Record<string, { price: string; network: string }> = {
  [ApiPaths.workflowsGenerate]: {
    price: "$0.15",
    network: SKALE_BASE_MAINNET_CAIP,
  },
  ["/workflows/generate"]: {
    price: "$0.15",
    network: SKALE_BASE_MAINNET_CAIP,
  },
  [ApiPaths.deploy]: { price: "$0.15", network: SKALE_BASE_MAINNET_CAIP },
  [ApiPaths.compile]: { price: "$0.02", network: SKALE_BASE_MAINNET_CAIP },
  [ApiPaths.audit]: { price: "$0.10", network: SKALE_BASE_MAINNET_CAIP },
};

export function runPath(runId: string): string {
  return `${API_V1}/runs/${encodeURIComponent(runId)}`;
}

export function runStepsPath(runId: string): string {
  return `${API_V1}/runs/${encodeURIComponent(runId)}/steps`;
}

export function runApproveSpecPath(runId: string): string {
  return `${API_V1}/runs/${encodeURIComponent(runId)}/approve_spec`;
}

export function workflowPath(workflowId: string): string {
  return `${API_V1}/workflows/${encodeURIComponent(workflowId)}`;
}

export function workflowStatusPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/status`;
}

export function workflowDeployApprovePath(workflowId: string): string {
  return `${workflowPath(workflowId)}/deploy/approve`;
}

export function workflowDeployPreparePath(workflowId: string, query: string): string {
  return `${workflowPath(workflowId)}/deploy/prepare?${query}`;
}

export function workflowDeployCompletePath(workflowId: string): string {
  return `${workflowPath(workflowId)}/deploy/complete`;
}

export function workflowContractsPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/contracts`;
}

export function workflowDeploymentsPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/deployments`;
}

export function workflowDebugSandboxPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/debug-sandbox`;
}

export function workflowClarifyPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/clarify`;
}

export function workflowCancelPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/cancel`;
}

export function workflowDiscussionStreamPath(workflowId: string): string {
  return `${API_V1}/streaming/workflows/${encodeURIComponent(workflowId)}/discussion`;
}

export function workflowUiSchemaPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/ui-schema`;
}

export function workflowUiSchemaGeneratePath(workflowId: string): string {
  return `${workflowPath(workflowId)}/ui-schema/generate`;
}

export function workflowUiAppsExportPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/ui-apps/export`;
}

export function workflowQuarantinePath(workflowId: string): string {
  return `${workflowPath(workflowId)}/quarantine`;
}

export function workflowRollbackPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/rollback`;
}

export function workflowRetryPath(workflowId: string): string {
  return `${workflowPath(workflowId)}/retry`;
}

export function networksRpcTestPath(networkId: string): string {
  return `${ApiPaths.networks}/rpc-test?network_id=${encodeURIComponent(networkId)}`;
}

export function streamingWorkflowCodePath(workflowId: string): string {
  return `${API_V1}/streaming/workflows/${encodeURIComponent(workflowId)}/code`;
}

export function agentRegistryAgentPath(agentId: string): string {
  return `${ApiPaths.agentRegistryAgents}/${encodeURIComponent(agentId)}`;
}

export function agentRegistryCapabilityAgentsPath(
  name: string,
  query: string,
): string {
  const q = query ? `?${query}` : "";
  return `${API_V1}/agent-registry/capabilities/${encodeURIComponent(name)}/agents${q}`;
}

export function a2aTaskPath(taskId: string): string {
  return `${ApiPaths.a2aTasks}/${encodeURIComponent(taskId)}`;
}

export function erc8004AgentPath(agentId: string): string {
  return `${ApiPaths.erc8004Agents}/${encodeURIComponent(agentId)}`;
}

export function userTemplatePath(templateId: string): string {
  return `${ApiPaths.userTemplates}/${encodeURIComponent(templateId)}`;
}

export function userTemplateVersionsPath(templateId: string): string {
  return `${ApiPaths.userTemplates}/${encodeURIComponent(templateId)}/versions`;
}

export function artifactPath(cid: string): string {
  return `${ApiPaths.artifacts}/${encodeURIComponent(cid)}`;
}

export function artifactFetchPath(cid: string): string {
  return `${ApiPaths.artifacts}/${encodeURIComponent(cid)}/fetch`;
}

export function workflowsGeneratePath(): string {
  return ApiPaths.workflowsGenerate;
}

/**
 * Paths where Studio suppresses console noise for optional public endpoints on network errors.
 */
export function isOptionalPublicApiPathForLogging(path: string | undefined): boolean {
  if (!path) return false;
  if (path === ApiPaths.config || path === GatewayLegacyMountPaths.config) return true;
  if (path === ApiPaths.platformTrackRecord || path === GatewayLegacyMountPaths.platformTrackRecord)
    return true;
  if (path.endsWith(ApiPaths.platformTrackRecord)) return true;
  return false;
}
