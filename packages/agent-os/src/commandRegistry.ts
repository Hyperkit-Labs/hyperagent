/**
 * Central command registry: one composition root for discoverable HTTP entrypoints.
 * Registration holds metadata only; handlers are mounted by the host (e.g. agent-runtime).
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type CommandCategory = "agent" | "health" | "internal";

export interface CommandDefinition {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  category: CommandCategory;
  /** Optional feature flag name for gating in upstream proxies or Studio. */
  featureFlag?: string;
  /** If true, omit from public discovery lists when policy requires. */
  internalOnly?: boolean;
}

export interface CommandDiscoveryEntry {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  category: CommandCategory;
  featureFlag?: string;
  internalOnly?: boolean;
}

export class CommandRegistry {
  private readonly commands = new Map<string, CommandDefinition>();

  register(def: CommandDefinition): void {
    if (this.commands.has(def.id)) {
      throw new Error(`CommandRegistry: duplicate command id "${def.id}"`);
    }
    this.commands.set(def.id, { ...def });
  }

  get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  list(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  /** Serializable list for GET /registry/commands and tooling. */
  toDiscoveryJson(): CommandDiscoveryEntry[] {
    return this.list().map(
      ({ id, method, path, description, category, featureFlag, internalOnly }) => ({
        id,
        method,
        path,
        description,
        category,
        ...(featureFlag !== undefined ? { featureFlag } : {}),
        ...(internalOnly !== undefined ? { internalOnly } : {}),
      }),
    );
  }
}
