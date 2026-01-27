import { monitorNode } from "../../nodes/monitorNode";
import { createMockStateWithContract, createMockStateWithDeployment } from "../helpers/testHelpers";

// Mock Chroma client
jest.mock("../../adapters/memory/chromaClient", () => ({
  createChromaClient: jest.fn(() => ({
    storeContract: jest.fn().mockResolvedValue(true),
  })),
}));

describe("monitorNode", () => {
  it("should save contract to Chroma and mark as success", async () => {
    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = {
      ...createMockStateWithContract(contract),
      ...createMockStateWithDeployment("0x1234", "0xabcd"),
    };

    const result = await monitorNode.execute(state);

    expect(result.status).toBe("success");
    expect(result.logs).toContain(expect.stringContaining("[MONITOR] ✓ Contract saved to Chroma"));
    expect(result.logs).toContain(expect.stringContaining("[MONITOR] Workflow complete"));
  });

  it("should skip storage when no deployment address", async () => {
    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = createMockStateWithContract(contract);

    const result = await monitorNode.execute(state);

    expect(result.status).toBe("success");
    expect(result.logs).toContain(expect.stringContaining("Skipping storage"));
  });

  it("should handle storage errors gracefully", async () => {
    const { createChromaClient } = require("../../adapters/memory/chromaClient");
    createChromaClient.mockImplementation(() => ({
      storeContract: jest.fn().mockRejectedValue(new Error("Chroma error")),
    }));

    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = {
      ...createMockStateWithContract(contract),
      ...createMockStateWithDeployment("0x1234", "0xabcd"),
    };

    const result = await monitorNode.execute(state);

    // Should still succeed despite storage error
    expect(result.status).toBe("success");
    expect(result.logs.some((log) => log.includes("Memory storage error"))).toBe(true);
  });
});

