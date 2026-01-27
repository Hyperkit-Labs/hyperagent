/**
 * Test helpers and utilities for orchestrator tests
 */

import { HyperAgentState, initialState } from "../../core/spec/state";

/**
 * Create a mock HyperAgentState for testing
 */
export function createMockState(overrides?: Partial<HyperAgentState>): HyperAgentState {
  const base = initialState("Test intent");
  return {
    ...base,
    ...overrides,
    meta: {
      ...base.meta,
      ...(overrides?.meta || {}),
    },
  };
}

/**
 * Create a mock state with a generated contract
 */
export function createMockStateWithContract(contract: string): HyperAgentState {
  return createMockState({
    contract,
    status: "processing",
  });
}

/**
 * Create a mock state with audit results
 */
export function createMockStateWithAudit(
  passed: boolean,
  findings: string[] = [],
): HyperAgentState {
  return createMockState({
    auditResults: { passed, findings },
    status: "auditing",
  });
}

/**
 * Create a mock state with deployment
 */
export function createMockStateWithDeployment(
  address: string,
  txHash: string,
): HyperAgentState {
  return createMockState({
    deploymentAddress: address,
    txHash,
    status: "deploying",
  });
}

/**
 * Reset environment variables for testing
 */
export function resetEnv(): void {
  // Clear cached config
  jest.resetModules();
}

/**
 * Mock environment variables for testing
 */
export function mockEnv(env: Record<string, string>): void {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Restore environment variables after test
 */
export function restoreEnv(): void {
  // Environment is automatically restored by jest
}

