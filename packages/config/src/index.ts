/**
 * @hyperagent/config
 * 
 * Shared typed configuration helpers for HyperAgent monorepo.
 * Reads and validates environment variables using Zod.
 */

import { z } from "zod";

/**
 * Base configuration schema for all apps
 */
export const baseConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
});

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  
  if (!result.success) {
    console.error("Configuration validation failed:", result.error.format());
    throw new Error("Invalid configuration");
  }
  
  return result.data;
}

/**
 * Example: HyperAgent API configuration
 */
export const hyperagentApiConfigSchema = baseConfigSchema.extend({
  BACKEND_HOST: z.string().default("localhost"),
  BACKEND_PORT: z.string().default("8000"),
  DATABASE_URL: z.string().url(),
});

export type HyperAgentApiConfig = z.infer<typeof hyperagentApiConfigSchema>;

/**
 * Example: HyperAgent Web configuration
 */
export const hyperagentWebConfigSchema = baseConfigSchema.extend({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: z.string().optional(),
});

export type HyperAgentWebConfig = z.infer<typeof hyperagentWebConfigSchema>;

