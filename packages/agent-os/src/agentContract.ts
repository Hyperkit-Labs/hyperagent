/**
 * Agent contracts: role definitions, delegation rules, capability declarations.
 * These are the shared types that agent-runtime and orchestrator implement against.
 * No business logic here; only narrow interfaces and validation.
 */

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  /** JSON Schema-compatible shape describing expected input. */
  inputSchema: Record<string, unknown>;
  /** JSON Schema-compatible shape describing expected output. */
  outputSchema: Record<string, unknown>;
  delegationRules: readonly DelegationRule[];
}

export interface DelegationRule {
  targetAgentId: string;
  condition: string;
  maxDepth: number;
}

export interface AgentCapability {
  agentId: string;
  tools: readonly string[];
  skills: readonly string[];
}

export interface SubagentConstraints {
  inheritTools: boolean;
  inheritSkills: boolean;
  mutableStateDomains: readonly string[];
  readOnlyStateDomains: readonly string[];
  maxDelegationDepth: number;
}

export interface AgentValidationError {
  field: string;
  message: string;
}

export function validateAgentRole(role: Partial<AgentRole>): AgentValidationError[] {
  const errors: AgentValidationError[] = [];

  if (!role.id || typeof role.id !== "string" || !role.id.trim()) {
    errors.push({ field: "id", message: "id is required and must be a non-empty string" });
  }
  if (!role.name || typeof role.name !== "string" || !role.name.trim()) {
    errors.push({ field: "name", message: "name is required and must be a non-empty string" });
  }
  if (!role.description || typeof role.description !== "string") {
    errors.push({ field: "description", message: "description is required" });
  }
  if (!role.inputSchema || typeof role.inputSchema !== "object") {
    errors.push({ field: "inputSchema", message: "inputSchema is required and must be an object" });
  }
  if (!role.outputSchema || typeof role.outputSchema !== "object") {
    errors.push({ field: "outputSchema", message: "outputSchema is required and must be an object" });
  }
  if (!Array.isArray(role.delegationRules)) {
    errors.push({ field: "delegationRules", message: "delegationRules must be an array" });
  } else {
    for (let i = 0; i < role.delegationRules.length; i++) {
      const rule = role.delegationRules[i];
      if (!rule.targetAgentId || typeof rule.targetAgentId !== "string") {
        errors.push({ field: `delegationRules[${i}].targetAgentId`, message: "targetAgentId is required" });
      }
      if (typeof rule.maxDepth !== "number" || rule.maxDepth < 1) {
        errors.push({ field: `delegationRules[${i}].maxDepth`, message: "maxDepth must be a positive integer" });
      }
    }
  }

  return errors;
}

export function canDelegate(
  from: AgentRole,
  targetAgentId: string,
  currentDepth: number,
): boolean {
  const rule = from.delegationRules.find((r) => r.targetAgentId === targetAgentId);
  if (!rule) return false;
  return currentDepth < rule.maxDepth;
}
