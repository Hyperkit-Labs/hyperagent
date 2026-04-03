/**
 * State domains: explicit ownership boundaries for runtime state.
 * Each domain is a branded type that prevents cross-domain mutation at the type level.
 * No implementation here; only contracts that services and stores implement against.
 */

/**
 * Brand tag for state domain types. Prevents accidental mixing of domain data
 * across boundaries (e.g. assigning session state into task state).
 */
declare const STATE_DOMAIN_BRAND: unique symbol;
type Branded<T, B extends string> = T & { readonly [STATE_DOMAIN_BRAND]: B };

export type SessionStateDomain = Branded<{
  sessionId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}, "session">;

export type TaskStateDomain = Branded<{
  taskId: string;
  status: string;
  parentTaskId?: string;
  createdAt: number;
  updatedAt: number;
}, "task">;

export type PermissionStateDomain = Branded<{
  subjectId: string;
  grants: readonly string[];
  denials: readonly string[];
  evaluatedAt: number;
}, "permission">;

export type PluginStateDomain = Branded<{
  pluginId: string;
  active: boolean;
  activatedAt: number;
  capabilities: readonly string[];
}, "plugin">;

export type MemoryStateDomain = Branded<{
  agentId: string;
  entries: number;
  lastWrittenAt: number;
}, "memory">;

export type BridgeStateDomain = Branded<{
  sessionId: string;
  remoteEndpoint: string;
  state: string;
  lastHeartbeat: number;
}, "bridge">;

export type TelemetryStateDomain = Branded<{
  traceId: string;
  spans: number;
  errorsLogged: number;
  lastFlushedAt: number;
}, "telemetry">;

export type StateDomainName =
  | "session"
  | "task"
  | "permission"
  | "plugin"
  | "memory"
  | "bridge"
  | "telemetry";

export interface StateDomainOwner {
  domain: StateDomainName;
  ownerService: string;
  description: string;
}

export const STATE_DOMAIN_OWNERS: readonly StateDomainOwner[] = [
  { domain: "session", ownerService: "api-gateway", description: "User session lifecycle" },
  { domain: "task", ownerService: "orchestrator", description: "Task creation and status tracking" },
  { domain: "permission", ownerService: "agent-os", description: "Permission policy evaluation" },
  { domain: "plugin", ownerService: "agent-os", description: "Plugin activation and lifecycle" },
  { domain: "memory", ownerService: "orchestrator", description: "Agent long-term memory" },
  { domain: "bridge", ownerService: "orchestrator", description: "Remote session management" },
  { domain: "telemetry", ownerService: "api-gateway", description: "Trace and metric collection" },
] as const;

export function getOwner(domain: StateDomainName): StateDomainOwner | undefined {
  return STATE_DOMAIN_OWNERS.find((o) => o.domain === domain);
}

export function isDomainOwnedBy(domain: StateDomainName, service: string): boolean {
  const owner = getOwner(domain);
  return owner?.ownerService === service;
}
