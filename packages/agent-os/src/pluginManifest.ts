/**
 * Plugin manifest: trust tiers, capability declarations, manifest validation.
 * Plugins must be validated before activation. This module enforces the trust boundary.
 */

export const PLUGIN_TRUST_TIERS = [
  "verified",
  "local",
  "session",
  "dev",
  "marketplace",
] as const;
export type PluginTrustTier = (typeof PLUGIN_TRUST_TIERS)[number];

export const PLUGIN_CAPABILITIES = [
  "register_commands",
  "register_skills",
  "provide_tools",
  "inject_mcp",
] as const;
export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  trustTier: PluginTrustTier;
  capabilities: readonly PluginCapability[];
  entrypoint: string;
  permissions: readonly string[];
  description?: string;
}

export interface PluginValidationError {
  field: string;
  message: string;
}

export interface PluginActivationResult {
  success: boolean;
  pluginId: string;
  error?: string;
}

/**
 * Capability whitelist per trust tier. Higher trust = more allowed capabilities.
 * Session and dev plugins cannot inject MCP integrations.
 */
const TIER_ALLOWED_CAPABILITIES: Record<PluginTrustTier, readonly PluginCapability[]> = {
  verified: ["register_commands", "register_skills", "provide_tools", "inject_mcp"],
  local: ["register_commands", "register_skills", "provide_tools", "inject_mcp"],
  marketplace: ["register_commands", "register_skills", "provide_tools"],
  session: ["register_commands", "register_skills"],
  dev: ["register_commands", "register_skills", "provide_tools"],
};

const SEMVER_RE = /^\d+\.\d+\.\d+/;

export function validateManifest(
  manifest: Partial<PluginManifest>,
): PluginValidationError[] {
  const errors: PluginValidationError[] = [];

  if (!manifest.id || typeof manifest.id !== "string" || !manifest.id.trim()) {
    errors.push({ field: "id", message: "id is required and must be a non-empty string" });
  }
  if (!manifest.name || typeof manifest.name !== "string" || !manifest.name.trim()) {
    errors.push({ field: "name", message: "name is required and must be a non-empty string" });
  }
  if (!manifest.version || typeof manifest.version !== "string" || !SEMVER_RE.test(manifest.version)) {
    errors.push({ field: "version", message: "version is required and must follow semver (e.g. 1.0.0)" });
  }
  if (!manifest.trustTier || !PLUGIN_TRUST_TIERS.includes(manifest.trustTier as PluginTrustTier)) {
    errors.push({
      field: "trustTier",
      message: `trustTier must be one of: ${PLUGIN_TRUST_TIERS.join(", ")}`,
    });
  }
  if (!manifest.entrypoint || typeof manifest.entrypoint !== "string" || !manifest.entrypoint.trim()) {
    errors.push({ field: "entrypoint", message: "entrypoint is required" });
  }
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    errors.push({ field: "capabilities", message: "capabilities must be a non-empty array" });
  } else {
    for (const cap of manifest.capabilities) {
      if (!PLUGIN_CAPABILITIES.includes(cap)) {
        errors.push({ field: "capabilities", message: `unknown capability: "${cap}"` });
      }
    }

    if (manifest.trustTier && PLUGIN_TRUST_TIERS.includes(manifest.trustTier as PluginTrustTier)) {
      const allowed = TIER_ALLOWED_CAPABILITIES[manifest.trustTier as PluginTrustTier];
      for (const cap of manifest.capabilities) {
        if (!allowed.includes(cap)) {
          errors.push({
            field: "capabilities",
            message: `capability "${cap}" is not allowed for trust tier "${manifest.trustTier}"`,
          });
        }
      }
    }
  }

  if (!Array.isArray(manifest.permissions)) {
    errors.push({ field: "permissions", message: "permissions must be an array" });
  }

  return errors;
}
