import { policyNode } from "../../nodes/policyNode";
import { createMockState } from "../helpers/testHelpers";

describe("policyNode", () => {
  it("should pass valid intent", async () => {
    const state = createMockState({
      intent: "Create an ERC20 token contract",
    });

    const result = await policyNode.execute(state);

    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[POLICY] ✓ Intent valid"));
  });

  it("should reject intent with selfdestruct", async () => {
    const state = createMockState({
      intent: "Create a contract with selfdestruct",
    });

    const result = await policyNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs).toContain(expect.stringContaining("[POLICY] Violations"));
  });

  it("should reject intent with delegatecall", async () => {
    const state = createMockState({
      intent: "Create a contract using delegatecall",
    });

    const result = await policyNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs).toContain(expect.stringContaining("no_delegatecall"));
  });

  it("should reject empty intent", async () => {
    const state = createMockState({
      intent: "",
    });

    const result = await policyNode.execute(state);

    expect(result.status).toBe("failed");
    expect(result.logs).toContain(expect.stringContaining("[POLICY] Invalid intent"));
  });

  it("should reject intent that is too long", async () => {
    const state = createMockState({
      intent: "a".repeat(501),
    });

    const result = await policyNode.execute(state);

    expect(result.status).toBe("failed");
  });
});

