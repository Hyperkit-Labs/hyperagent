import { z } from "zod";

/** GET /api/v1/config — mirrors `get_config_api` in orchestrator (extra keys allowed). */
export const integrationsStatusSchema = z
  .object({
    tenderly_configured: z.boolean().optional(),
    pinata_configured: z.boolean().optional(),
    qdrant_configured: z.boolean().optional(),
  })
  .passthrough();

export const orchestratorPublicConfigSchema = z
  .object({
    x402_enabled: z.boolean(),
    monitoring_enabled: z.boolean().optional(),
    merchant_wallet_address: z.string().nullable().optional(),
    credits_enabled: z.boolean().optional(),
    credits_per_usd: z.number().optional(),
    credits_per_run: z.number().optional(),
    integrations: integrationsStatusSchema.optional(),
    default_network_id: z.string().optional(),
    default_chain_id: z.number().optional(),
    a2a_agent_id: z.string().nullable().optional(),
    a2a_default_chain_id: z.number().nullable().optional(),
    a2a_identity: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough();

export type OrchestratorPublicConfig = z.infer<
  typeof orchestratorPublicConfigSchema
>;
