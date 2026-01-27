import { deployNode } from "../../nodes/deployNode";
import { createMockStateWithContract, createMockStateWithAudit } from "../helpers/testHelpers";

// Mock deployment adapter
jest.mock("../../adapters/deployment/thirdwebDeployer", () => ({
  executeDeployment: jest.fn().mockResolvedValue({
    contractAddress: "0x1234567890123456789012345678901234567890",
    txHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
  }),
}));

jest.mock("../../adapters/deployment/compileAdapter", () => ({
  needsCompilation: jest.fn().mockReturnValue(false),
}));

describe("deployNode", () => {
  beforeEach(() => {
    process.env.DEPLOYER_PRIVATE_KEY = "0x" + "1".repeat(64);
  });

  afterEach(() => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
  });

  it("should deploy contract successfully", async () => {
    const bytecode = "0x6080604052348015600f57600080fd5b50";
    const state = {
      ...createMockStateWithContract(bytecode),
      ...createMockStateWithAudit(true, []),
      meta: {
        ...createMockStateWithContract(bytecode).meta,
        chains: { selected: "mantle", requested: ["mantle"] },
      },
    };

    const result = await deployNode.execute(state);

    expect(result.deploymentAddress).toBeTruthy();
    expect(result.txHash).toBeTruthy();
    expect(result.status).toBe("deploying");
    expect(result.logs).toContain(expect.stringContaining("[DEPLOY] ✓ Deployment successful"));
  });

  it("should fail when contract is empty", async () => {
    const state = {
      ...createMockStateWithContract(""),
      ...createMockStateWithAudit(true, []),
    };

    const result = await deployNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs).toContain(expect.stringContaining("[DEPLOY] Error: No contract code"));
  });

  it("should fail when DEPLOYER_PRIVATE_KEY is missing", async () => {
    delete process.env.DEPLOYER_PRIVATE_KEY;

    const bytecode = "0x6080604052348015600f57600080fd5b50";
    const state = {
      ...createMockStateWithContract(bytecode),
      ...createMockStateWithAudit(true, []),
      meta: {
        ...createMockStateWithContract(bytecode).meta,
        chains: { selected: "mantle", requested: ["mantle"] },
      },
    };

    const result = await deployNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs).toContain(expect.stringContaining("DEPLOYER_PRIVATE_KEY not set"));
  });

  it("should handle deployment errors", async () => {
    const { executeDeployment } = require("../../adapters/deployment/thirdwebDeployer");
    executeDeployment.mockRejectedValueOnce(new Error("Deployment failed"));

    const bytecode = "0x6080604052348015600f57600080fd5b50";
    const state = {
      ...createMockStateWithContract(bytecode),
      ...createMockStateWithAudit(true, []),
      meta: {
        ...createMockStateWithContract(bytecode).meta,
        chains: { selected: "mantle", requested: ["mantle"] },
      },
    };

    const result = await deployNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs.some((log) => log.includes("[DEPLOY] Error"))).toBe(true);
  });
});

