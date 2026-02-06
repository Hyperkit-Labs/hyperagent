import { eigendaNode } from "../../nodes/eigendaNode";
import { createMockStateWithContract, createMockStateWithDeployment } from "../helpers/testHelpers";

// Mock Pinata client
jest.mock("../../adapters/memory/pinataClient", () => ({
  createPinataClient: jest.fn(() => ({
    pinJSONToIPFS: jest.fn().mockResolvedValue("QmMockCID123456789"),
    isConfigured: jest.fn().mockReturnValue(true),
  })),
}));

describe("eigendaNode", () => {
  it("should pin contract to IPFS", async () => {
    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = {
      ...createMockStateWithContract(contract),
      ...createMockStateWithDeployment("0x1234", "0xabcd"),
    };

    const result = await eigendaNode.execute(state);

    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[EIGENDA] ✓ Proof stored to IPFS"));
  });

  it("should skip IPFS when Pinata not configured", async () => {
    const { createPinataClient } = require("../../adapters/memory/pinataClient");
    createPinataClient.mockImplementation(() => ({
      isConfigured: jest.fn().mockReturnValue(false),
    }));

    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = {
      ...createMockStateWithContract(contract),
      ...createMockStateWithDeployment("0x1234", "0xabcd"),
    };

    const result = await eigendaNode.execute(state);

    expect(result.logs).toContain(expect.stringContaining("Pinata not configured"));
  });

  it("should handle IPFS pinning errors gracefully", async () => {
    const { createPinataClient } = require("../../adapters/memory/pinataClient");
    createPinataClient.mockImplementation(() => ({
      pinJSONToIPFS: jest.fn().mockRejectedValue(new Error("IPFS error")),
      isConfigured: jest.fn().mockReturnValue(true),
    }));

    const contract = "pragma solidity ^0.8.0; contract Test {}";
    const state = {
      ...createMockStateWithContract(contract),
      ...createMockStateWithDeployment("0x1234", "0xabcd"),
    };

    const result = await eigendaNode.execute(state);

    // Should not fail workflow
    expect(result.status).toBe("processing");
    expect(result.logs.some((log) => log.includes("Error pinning to IPFS"))).toBe(true);
  });
});

