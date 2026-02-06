/**
 * Orchestrator environment configuration
 * Centralized, validated environment variable access
 * 
 * Follows pattern from ts/api/src/config/env.ts
 * Uses Zod for runtime validation and TypeScript type inference
 */

import { z } from "zod";

// Try to load root .env if @hyperagent/env is available
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadRootEnv } = require("@hyperagent/env");
  if (loadRootEnv) {
    loadRootEnv();
  }
} catch {
  // @hyperagent/env not available, continue without it
  // Environment variables will be read from process.env directly
}

/**
 * Environment variable schema for orchestrator
 * All env vars are optional with defaults for development
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // LLM API Keys
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Deployment
  DEPLOYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional()
    .describe("Private key for contract deployment (64 hex chars with 0x prefix)"),

  // Memory/Storage Services
  CHROMA_BASE_URL: z.string().url().default("http://localhost:8000"),
  PINATA_API_KEY: z.string().optional(),
  PINATA_API_SECRET: z.string().optional(),

  // Backend Services
  PYTHON_BACKEND_URL: z.string().url().default("http://localhost:8000"),

  // Network RPC URLs (optional, can be configured per-network)
  RPC_URL_MANTLE_TESTNET: z.string().url().optional(),
  RPC_URL_MANTLE_MAINNET: z.string().url().optional(),
  RPC_URL_AVALANCHE_FUJI: z.string().url().optional(),
  RPC_URL_AVALANCHE_MAINNET: z.string().url().optional(),
});

export type OrchestratorEnv = z.infer<typeof envSchema>;

let cachedConfig: OrchestratorEnv | null = null;

/**
 * Load and validate orchestrator environment configuration
 * 
 * @returns Validated environment configuration
 * @throws Error if validation fails
 */
export function loadOrchestratorEnv(): OrchestratorEnv {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    const errors = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Invalid orchestrator environment variables: ${errors}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

/**
 * Get orchestrator configuration (singleton)
 * Loads config on first access, caches for subsequent calls
 */
export const config = loadOrchestratorEnv();

/**
 * Reset cached config (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

