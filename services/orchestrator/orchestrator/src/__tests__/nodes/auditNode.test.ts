import { auditNode } from "../../nodes/auditNode";
import { createMockStateWithContract } from "../helpers/testHelpers";
import { mockCallAnthropic } from "../helpers/mocks";

// Mock Python audit client
jest.mock("../../adapters/audit/pythonAuditClient", () => ({
  createPythonAuditClient: jest.fn(() => ({
    auditContract: jest.fn().mockResolvedValue({
      status: "success",
      vulnerabilities: [],
      overall_risk_score: 0,
      audit_status: "passed",
    }),
    mapFindingsToOrchestratorFormat: jest.fn((response) => ({
      passed: response.audit_status === "passed",
      findings: [],
    })),
  })),
}));

// Mock Anthropic client
jest.mock("../../adapters/llm/anthropicClient", () => ({
  callAnthropic: jest.fn(mockCallAnthropic),
}));

describe("auditNode", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("should audit contract using Python backend", async () => {
    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = createMockStateWithContract(contract);

    const result = await auditNode.execute(state);

    expect(result.auditResults.passed).toBe(true);
    expect(result.status).toBe("auditing");
    expect(result.logs).toContain(expect.stringContaining("[AUDIT] Python backend audit"));
  });

  it("should fallback to LLM audit when Python backend fails", async () => {
    const { createPythonAuditClient } = require("../../adapters/audit/pythonAuditClient");
    createPythonAuditClient.mockImplementation(() => ({
      auditContract: jest.fn().mockRejectedValue(new Error("Python backend unavailable")),
    }));

    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = createMockStateWithContract(contract);

    const result = await auditNode.execute(state);

    expect(result.logs.some((log) => log.includes("LLM audit"))).toBe(true);
  });

  it("should reject empty contract", async () => {
    const state = createMockStateWithContract("");

    const result = await auditNode.execute(state);

    expect(result.auditResults.passed).toBe(false);
    expect(result.auditResults.findings).toContain("Empty contract");
  });

  it("should handle audit failures gracefully", async () => {
    const { createPythonAuditClient } = require("../../adapters/audit/pythonAuditClient");
    createPythonAuditClient.mockImplementation(() => ({
      auditContract: jest.fn().mockResolvedValue({
        status: "error",
        error: "Audit failed",
      }),
      mapFindingsToOrchestratorFormat: jest.fn(() => ({
        passed: false,
        findings: ["Audit failed"],
      })),
    }));

    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = createMockStateWithContract(contract);

    const result = await auditNode.execute(state);

    expect(result.auditResults.passed).toBe(false);
    expect(result.auditResults.findings.length).toBeGreaterThan(0);
  });
});

