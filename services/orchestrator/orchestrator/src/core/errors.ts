/**
 * Custom error classes for orchestrator
 * Provides structured error handling with context and error codes
 */

import { ORCHESTRATOR_ERROR_CODES } from "./constants";

/**
 * Base orchestrator error class
 */
export class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrchestratorError";
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Node execution error
 * Thrown when a node fails to execute
 */
export class NodeExecutionError extends OrchestratorError {
  constructor(
    nodeName: string,
    cause: Error,
    context?: Record<string, unknown>,
  ) {
    super(
      `Node ${nodeName} execution failed: ${cause.message}`,
      ORCHESTRATOR_ERROR_CODES.NODE_EXECUTION_FAILED,
      {
        nodeName,
        cause: cause.message,
        causeStack: cause.stack,
        ...context,
      },
    );
    this.name = "NodeExecutionError";
  }
}

/**
 * State validation error
 * Thrown when state validation fails
 */
export class StateValidationError extends OrchestratorError {
  constructor(
    message: string,
    validationErrors?: string[],
    context?: Record<string, unknown>,
  ) {
    super(
      `State validation failed: ${message}`,
      ORCHESTRATOR_ERROR_CODES.VALIDATION_FAILED,
      {
        validationErrors,
        ...context,
      },
    );
    this.name = "StateValidationError";
  }
}

/**
 * Deployment error
 * Thrown when contract deployment fails
 */
export class DeploymentError extends OrchestratorError {
  constructor(
    message: string,
    network?: string,
    context?: Record<string, unknown>,
  ) {
    super(
      `Deployment failed: ${message}`,
      ORCHESTRATOR_ERROR_CODES.DEPLOYMENT_FAILED,
      {
        network,
        ...context,
      },
    );
    this.name = "DeploymentError";
  }
}

/**
 * Memory storage error
 * Thrown when storing to Chroma/IPFS fails
 */
export class MemoryStorageError extends OrchestratorError {
  constructor(
    message: string,
    storageType: "chroma" | "ipfs",
    context?: Record<string, unknown>,
  ) {
    super(
      `Memory storage failed (${storageType}): ${message}`,
      ORCHESTRATOR_ERROR_CODES.MEMORY_STORAGE_FAILED,
      {
        storageType,
        ...context,
      },
    );
    this.name = "MemoryStorageError";
  }
}

/**
 * LLM error
 * Thrown when LLM API calls fail
 */
export class LLMError extends OrchestratorError {
  constructor(
    message: string,
    provider?: string,
    context?: Record<string, unknown>,
  ) {
    super(
      `LLM error${provider ? ` (${provider})` : ""}: ${message}`,
      ORCHESTRATOR_ERROR_CODES.LLM_ERROR,
      {
        provider,
        ...context,
      },
    );
    this.name = "LLMError";
  }
}

/**
 * Network error
 * Thrown when network requests fail
 */
export class NetworkError extends OrchestratorError {
  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(
      `Network error: ${message}`,
      ORCHESTRATOR_ERROR_CODES.NETWORK_ERROR,
      {
        url,
        statusCode,
        ...context,
      },
    );
    this.name = "NetworkError";
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof NetworkError) {
    // Retry on 5xx errors, timeouts, or network failures
    const statusCode = (error.context?.statusCode as number) || 0;
    return statusCode >= 500 || statusCode === 0;
  }

  if (error instanceof LLMError) {
    // Retry on rate limits or temporary failures
    const message = error.message.toLowerCase();
    return message.includes("rate limit") || message.includes("timeout");
  }

  // Don't retry validation or deployment errors
  if (
    error instanceof StateValidationError ||
    error instanceof DeploymentError
  ) {
    return false;
  }

  // Default: retry on other errors
  return true;
}

