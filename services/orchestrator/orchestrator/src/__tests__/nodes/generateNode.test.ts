import { generateNode } from "../../nodes/generateNode";
import { createMockState } from "../helpers/testHelpers";
import { mockCallAnthropic } from "../helpers/mocks";

// Mock the Anthropic client
jest.mock("../../adapters/llm/anthropicClient", () => ({
  callAnthropic: jest.fn(mockCallAnthropic),
}));

// Mock Chroma client
jest.mock("../../adapters/memory/chromaClient", () => ({
  createChromaClient: jest.fn(() => ({
    findSimilar: jest.fn().mockResolvedValue([]),
  })),
}));

describe("generateNode", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;
  });

  it("should generate contract from intent", async () => {
    const state = createMockState({
      intent: "Create an ERC20 token",
    });

    const result = await generateNode.execute(state);

    expect(result.contract).toBeTruthy();
    expect(result.contract.length).toBeGreaterThan(0);
    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[GENERATE] Contract generated"));
  });

  it("should use fallback contract when API key is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_API_KEY;

    const state = createMockState({
      intent: "Create an ERC20 token",
    });

    const result = await generateNode.execute(state);

    expect(result.contract).toBeTruthy();
    expect(result.logs).toContain(expect.stringContaining("fallback"));
  });

  it("should search memory for similar contracts", async () => {
    const state = createMockState({
      intent: "Create an ERC20 token",
    });

    const result = await generateNode.execute(state);

    expect(result.logs.some((log) => log.includes("[GENERATE] Searching memory"))).toBe(true);
  });

  it("should handle memory search failures gracefully", async () => {
    const { createChromaClient } = require("../../adapters/memory/chromaClient");
    createChromaClient.mockImplementation(() => ({
      findSimilar: jest.fn().mockRejectedValue(new Error("Chroma unavailable")),
    }));

    const state = createMockState({
      intent: "Create an ERC20 token",
    });

    const result = await generateNode.execute(state);

    // Should continue despite memory failure
    expect(result.contract).toBeTruthy();
    expect(result.logs.some((log) => log.includes("Memory search failed"))).toBe(true);
  });
});

