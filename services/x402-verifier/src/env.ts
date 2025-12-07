import dotenv from "dotenv";
import path from "path";

// Get directory using process.cwd() (works in both CommonJS and ESM)
// When running from services/x402-verifier, go up two levels to root
const rootEnv = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnv });

// Also try local .env (one level up) - don't override root values
const localEnv = path.resolve(process.cwd(), '../.env');
dotenv.config({ path: localEnv, override: false });

export {};
