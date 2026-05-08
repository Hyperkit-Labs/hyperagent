import { z } from "zod";
import {
  specLockExample,
  specLockJsonSchema,
} from "../generated/spec-lock.schema.js";

export const specLockChainTargetSchema = z
  .object({
    chain_id: z.number().int().optional(),
    network_name: z.string().optional(),
  })
  .strict();

export const specLockRiskProfileSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const specLockSchema = z
  .object({
    version: z.string().min(1),
    chains: z.array(z.union([z.string(), specLockChainTargetSchema])),
    token_type: z.string().min(1),
    features: z.array(z.string()),
    invariants: z.array(z.record(z.string(), z.unknown())),
    risk_profile: specLockRiskProfileSchema.default("medium"),
    template_id: z.string().optional(),
    app_type: z.string().optional(),
    multi_contract: z.boolean().optional(),
    roles: z.array(z.string()).default([]),
    oracles: z.array(z.record(z.string(), z.unknown())).default([]),
    frontend_actions: z.array(z.string()).default([]),
    wizard_options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type SpecLock = z.infer<typeof specLockSchema>;

export { specLockExample, specLockJsonSchema };
