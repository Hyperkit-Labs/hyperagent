import { loadRootEnv } from "@hyperagent/env";
import { z } from "zod";

// Load repo-root .env (single source of truth) before validating process.env.
loadRootEnv();

type JsonObject = Record<string, unknown>;

function safeParseJsonObject(raw: string | undefined): JsonObject | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as JsonObject;
    }
    return null;
  } catch {
    return null;
  }
}

function resolvePriceTier(raw: string | undefined, fallback: number | undefined): string | undefined {
  if (raw !== undefined && raw !== "") {
    return raw;
  }
  return fallback === undefined ? undefined : String(fallback);
}

const priceTiers = safeParseJsonObject(process.env.X402_PRICE_TIERS) as Record<string, unknown> | null;
const tierBasic = typeof priceTiers?.basic === "number" ? priceTiers.basic : undefined;
const tierAdvanced = typeof priceTiers?.advanced === "number" ? priceTiers.advanced : undefined;
const tierDeployment = typeof priceTiers?.deployment === "number" ? priceTiers.deployment : undefined;

// Map legacy/root env names to the TS API-specific env schema.
// This keeps .env.example stable while TS services can adopt a more explicit naming.
const rawEnv: Record<string, string | undefined> = {
  ...process.env,

  // Common app naming
  NODE_ENV: process.env.NODE_ENV ?? process.env.APP_ENV,

  // TS-first API settings
  PORT: process.env.PORT ?? process.env.TS_API_PORT,

  // Service URLs
  PYTHON_BACKEND_URL: process.env.PYTHON_BACKEND_URL,
  X402_VERIFIER_URL: process.env.X402_VERIFIER_URL ?? process.env.X402_SERVICE_URL,

  // Thirdweb
  THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID,

  // x402 config
  X402_ENABLED_NETWORKS: process.env.X402_ENABLED_NETWORKS,

  // Deployment
  DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY ?? process.env.PRIVATE_KEY,
  RPC_URL_AVALANCHE_FUJI: process.env.RPC_URL_AVALANCHE_FUJI ?? process.env.AVALANCHE_FUJI_RPC,
  RPC_URL_AVALANCHE_MAINNET:
    process.env.RPC_URL_AVALANCHE_MAINNET ?? process.env.AVALANCHE_MAINNET_RPC,
  RPC_URL_MANTLE_TESTNET: process.env.RPC_URL_MANTLE_TESTNET ?? process.env.MANTLE_TESTNET_RPC,
  RPC_URL_MANTLE_MAINNET: process.env.RPC_URL_MANTLE_MAINNET ?? process.env.MANTLE_MAINNET_RPC,

  // Prefer X402_PRICE_TIERS if present (root env standard)
  X402_CONTRACT_PRICE_USDC: resolvePriceTier(process.env.X402_CONTRACT_PRICE_USDC, tierBasic),
  X402_WORKFLOW_PRICE_USDC: resolvePriceTier(process.env.X402_WORKFLOW_PRICE_USDC, tierAdvanced),
  X402_DEPLOY_PRICE_USDC: resolvePriceTier(process.env.X402_DEPLOY_PRICE_USDC, tierDeployment),
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  PYTHON_BACKEND_URL: z.string().url().optional(),
  X402_VERIFIER_URL: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  // Thirdweb
  THIRDWEB_CLIENT_ID: z.string().optional(),

  // x402
  X402_ENABLED: z.coerce.boolean().default(false),
  X402_ENABLED_NETWORKS: z.string().default("avalanche_fuji,avalanche_mainnet"),

  // Deployment (server-side deployment runner)
  DEPLOYER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  RPC_URL_AVALANCHE_FUJI: z.string().url().optional(),
  RPC_URL_AVALANCHE_MAINNET: z.string().url().optional(),
  RPC_URL_MANTLE_TESTNET: z.string().url().optional(),
  RPC_URL_MANTLE_MAINNET: z.string().url().optional(),

  // Optional legacy JSON blob: {"network_key": "https://..."}
  RPC_URLS: z.string().optional(),

  // x402 (used by endpoints that require payment)
  MERCHANT_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  X402_CONTRACT_PRICE_USDC: z.coerce.number().default(0.01),
  X402_WORKFLOW_PRICE_USDC: z.coerce.number().default(0.02),
  X402_DEPLOY_PRICE_USDC: z.coerce.number().default(0.1),

  // Audit tooling toggles (TS-only backend; deep tools are invoked via Docker when enabled)
  AUDIT_SOLHINT_ENABLED: z.coerce.boolean().default(true),
  AUDIT_SOLHINT_STRICT: z.coerce.boolean().default(false),
  AUDIT_DEEP_TOOLS_ENABLED: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  return parsed.data;
}
