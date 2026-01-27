/**
 * Constants for orchestrator
 * Centralized location for magic numbers, timeouts, and configuration values
 */

/**
 * Node execution timeouts (in milliseconds)
 */
export const NODE_TIMEOUTS = {
  POLICY: 5_000,
  GENERATE: 30_000,
  AUDIT: 60_000,
  VALIDATE: 10_000,
  DEPLOY: 120_000,
  EIGENDA: 30_000,
  MONITOR: 10_000,
} as const;

/**
 * Default retry counts for nodes
 */
export const NODE_RETRIES = {
  POLICY: 1,
  GENERATE: 3,
  AUDIT: 2,
  VALIDATE: 1,
  DEPLOY: 3,
  EIGENDA: 2,
  MONITOR: 1,
} as const;

/**
 * Default service URLs
 */
export const DEFAULT_URLS = {
  CHROMA_BASE_URL: "http://localhost:8000",
  PYTHON_BACKEND_URL: "http://localhost:8000",
  PINATA_API_URL: "https://api.pinata.cloud",
  PINATA_GATEWAY_URL: "https://gateway.pinata.cloud",
} as const;

/**
 * Memory/Storage configuration
 */
export const MEMORY_CONFIG = {
  CHROMA_COLLECTION_NAME: "smart_contracts",
  DEFAULT_SEARCH_LIMIT: 5,
  MAX_SEARCH_LIMIT: 20,
  EMBEDDING_DIMENSION_OPENAI: 1536,
  EMBEDDING_DIMENSION_SMALL: 768,
} as const;

/**
 * Contract validation limits
 */
export const VALIDATION_LIMITS = {
  MAX_INTENT_LENGTH: 500,
  MIN_INTENT_LENGTH: 1,
  MAX_CONTRACT_SIZE_BYTES: 24_576, // EIP-170 limit
  MAX_FINDINGS_COUNT: 50,
} as const;

/**
 * Deployment configuration
 */
export const DEPLOYMENT_CONFIG = {
  DEFAULT_NETWORK: "mantle",
  GAS_LIMIT_BUFFER: 1.2, // 20% buffer for gas estimation
  CONFIRMATION_BLOCKS: 1,
  TIMEOUT_BLOCKS: 50,
} as const;

/**
 * Error codes (aligned with blueprint spec)
 * Note: Blueprint ERROR_CODES are in core/spec/errors.ts
 * These are additional error codes for orchestrator internals
 */
export const ORCHESTRATOR_ERROR_CODES = {
  INVALID_STATE: "INVALID_STATE",
  NODE_EXECUTION_FAILED: "NODE_EXECUTION_FAILED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  DEPLOYMENT_FAILED: "DEPLOYMENT_FAILED",
  MEMORY_STORAGE_FAILED: "MEMORY_STORAGE_FAILED",
  LLM_ERROR: "LLM_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

