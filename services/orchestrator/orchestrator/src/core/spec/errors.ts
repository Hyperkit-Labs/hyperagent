/**
 * DESIGN TOKEN: Error Codes
 * EXACTLY these codes. No custom errors.
 */
export interface ErrorCode {
  name: string;
  recoverable: boolean;
  action: string;
}

export const ERROR_CODES: Record<string, ErrorCode> = {
  E001: { name: "INVALID_INTENT", recoverable: true, action: "retry_policy" },
  E002: { name: "GENERATION_FAILED", recoverable: true, action: "retry_generate" },
  E003: { name: "AUDIT_FAILED", recoverable: true, action: "mutate_contract" },
  E004: { name: "VALIDATION_FAILED", recoverable: true, action: "retry_generate" },
  E005: { name: "DEPLOYMENT_FAILED", recoverable: false, action: "escalate_user" },
  E006: { name: "STORAGE_FAILED", recoverable: false, action: "log_alert" },
};

/**
 * DESIGN TOKEN: Retry Policy
 * EXACTLY this exponential backoff.
 */
export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  sequence: number[];
}

export const RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  sequence: [1000, 2000, 4000],
};

/**
 * Calculate delay for retry attempt (0-indexed)
 */
export function getRetryDelay(attempt: number): number {
  if (attempt >= RETRY_POLICY.sequence.length) {
    return RETRY_POLICY.maxDelayMs;
  }
  return RETRY_POLICY.sequence[attempt];
}

/**
 * DESIGN TOKEN: Fallback Responses
 * When LLM fails, use ONLY these templates.
 */
export const FALLBACK_CONTRACTS: Record<string, string> = {
  erc20: "pragma solidity ^0.8.0; contract Token { ... }",
  erc721: "pragma solidity ^0.8.0; contract NFT { ... }",
  multisig: "pragma solidity ^0.8.0; contract MultiSig { ... }",
};

