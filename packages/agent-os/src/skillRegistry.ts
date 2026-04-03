/**
 * Skill registry: reusable procedures with discovery, validation, and permission metadata.
 * Skills are repeatable and deterministic where possible. This module holds contracts only.
 */

import type { RiskTier } from "./permissionPolicy.js";

export interface SkillPermissionRequirements {
  minimumRisk: RiskTier;
  requiresApproval: boolean;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  allowedTools: readonly string[];
  promptTemplate: string;
  discoverable: boolean;
  permissionRequirements: SkillPermissionRequirements;
  /** Optional tags for categorization and search. */
  tags?: readonly string[];
}

export interface SkillInvocationResult {
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
}

export type SkillDiscoveryEntry = Pick<
  SkillDefinition,
  "id" | "name" | "description" | "tags" | "discoverable" | "permissionRequirements"
>;

export interface SkillValidationError {
  field: string;
  message: string;
}

export function validateSkillDefinition(
  def: Partial<SkillDefinition>,
): SkillValidationError[] {
  const errors: SkillValidationError[] = [];

  if (!def.id || typeof def.id !== "string" || !def.id.trim()) {
    errors.push({ field: "id", message: "id is required and must be a non-empty string" });
  }
  if (!def.name || typeof def.name !== "string" || !def.name.trim()) {
    errors.push({ field: "name", message: "name is required and must be a non-empty string" });
  }
  if (!def.description || typeof def.description !== "string") {
    errors.push({ field: "description", message: "description is required" });
  }
  if (!def.allowedTools || !Array.isArray(def.allowedTools) || def.allowedTools.length === 0) {
    errors.push({ field: "allowedTools", message: "allowedTools must be a non-empty array" });
  }
  if (!def.promptTemplate || typeof def.promptTemplate !== "string" || !def.promptTemplate.trim()) {
    errors.push({ field: "promptTemplate", message: "promptTemplate is required" });
  }
  if (typeof def.discoverable !== "boolean") {
    errors.push({ field: "discoverable", message: "discoverable must be a boolean" });
  }
  if (!def.permissionRequirements) {
    errors.push({ field: "permissionRequirements", message: "permissionRequirements is required" });
  }

  return errors;
}

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(def: SkillDefinition): void {
    const errors = validateSkillDefinition(def);
    if (errors.length > 0) {
      const detail = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
      throw new Error(`SkillRegistry: invalid definition for "${def.id ?? "(no id)"}": ${detail}`);
    }
    if (this.skills.has(def.id)) {
      throw new Error(`SkillRegistry: duplicate skill id "${def.id}"`);
    }
    this.skills.set(def.id, { ...def });
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  list(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  toDiscoveryJson(): SkillDiscoveryEntry[] {
    return this.list()
      .filter((s) => s.discoverable)
      .map(({ id, name, description, tags, discoverable, permissionRequirements }) => ({
        id,
        name,
        description,
        ...(tags ? { tags } : {}),
        discoverable,
        permissionRequirements,
      }));
  }
}
