import { runGraph } from "../core/graph/engine";
import { initialState } from "../core/spec/state";
import { nodeRegistry } from "../nodes";

describe("orchestrator graph", () => {
  test("happy path runs to terminal monitor node", async () => {
    const state = initialState("Create an ERC20 token");
    const finalState = await runGraph("policy", state, nodeRegistry);

    expect(finalState.status).toBe("success");
    expect(finalState.meta.version).toBe("v1");
    expect(finalState.logs.length).toBeGreaterThan(0);
  });

  test("validate failure loops back to generate", async () => {
    const state = initialState("Create a contract");
    // Force validation failure by clearing contract after generate would normally set it.
    state.contract = "";

    const finalState = await runGraph("validate", state, nodeRegistry);

    // Graph should keep running and eventually reach monitor with success
    expect(finalState.status).toBe("success");
  });
});


