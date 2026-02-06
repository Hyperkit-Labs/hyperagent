import { z } from "zod";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// Load root .env file - @hyperagent/env is optional and may not be available in Docker
// Use dotenv directly to load from repo root
const rootEnvPath = resolve(__dirname, "../../../../.env");
dotenvConfig({ path: rootEnvPath });
dotenvConfig(); // Also load local .env if exists

// Try to use @hyperagent/env if available (optional)
try {
  // Use dynamic require to avoid module resolution errors
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const envModule = require("@hyperagent/env");
  if (envModule && typeof envModule.loadRootEnv === "function") {
    envModule.loadRootEnv();
  }
} catch {
  // Module not available - dotenv already loaded above, continue
}

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

// Note: x402 pricing is now in config/x402.yaml
// Use getX402Pricing() from configLoader instead of env vars
const priceTiers = safeParseJsonObject(process.env.X402_PRICE_TIERS) as Record<string, unknown> | null;
const tierBasic = typeof priceTiers?.basic === "number" ? priceTiers.basic : undefined;
const tierAdvanced = typeof priceTiers?.advanced === "number" ? priceTiers.advanced : undefined;
const tierDeployment = typeof priceTiers?.deployment === "number" ? priceTiers.deployment : undefined;

// Helper to construct Supabase DATABASE_URL if SUPABASE_URL and SUPABASE_PASSWORD are set
function resolveDatabaseUrl(): string | undefined {
  const explicitDbUrl = process.env.DATABASE_URL;
  if (explicitDbUrl) {
    return explicitDbUrl;
  }

  // Try Supabase credentials (production)
  const supabaseUrl = process.env.SUPABASE_URL || process.env.supabase_url;
  const supabasePassword = process.env.SUPABASE_PASSWORD || process.env.supabase_password;

  if (supabaseUrl && supabasePassword) {
    // Construct Supabase connection string
    // Format: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
    const supabaseHost = supabaseUrl.replace("https://", "").replace("http://", "");
    return `postgresql://postgres:${supabasePassword}@db.${supabaseHost}:5432/postgres`;
  }

  // Default: Use localhost for local development (outside Docker)
  // Inside Docker, this is overridden by explicit DATABASE_URL env var
  return "postgresql://hyperagent_user:secure_password@localhost:5432/hyperagent_db";
}

// Map legacy/root env names to the TS API-specific env schema.
// This keeps .env.example stable while TS services can adopt a more explicit naming.
const rawEnv: Record<string, string | undefined> = {
  ...process.env,

  // Common app naming
  NODE_ENV: process.env.NODE_ENV ?? process.env.APP_ENV,

  // TS-first API settings
  PORT: process.env.PORT ?? process.env.TS_API_PORT,

  // Database - resolve from DATABASE_URL or Supabase credentials
  DATABASE_URL: resolveDatabaseUrl(),

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
  DATABASE_URL: z.string().url(), // Required - use Supabase or provide DATABASE_URL
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

  // x402 (deprecated - use config/x402.yaml and config/deployment.yaml instead)
  // Merchant wallet address is now in config/deployment.yaml (getMerchantWalletAddress())
  MERCHANT_WALLET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  // Pricing is now in config/x402.yaml (getX402Pricing())
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
