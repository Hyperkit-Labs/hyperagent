import { validateNode } from "../../nodes/validateNode";
import { createMockStateWithContract, createMockStateWithAudit } from "../helpers/testHelpers";

describe("validateNode", () => {
  it("should pass validation for valid contract", async () => {
    const state = createMockStateWithContract("pragma solidity ^0.8.0; contract Valid {}");
    const auditState = createMockStateWithAudit(true, []);

    const combinedState = {
      ...state,
      ...auditState,
    };

    const result = await validateNode.execute(combinedState);

    expect(result.status).toBe("validating");
    expect(result.logs).toContain(expect.stringContaining("[VALIDATE] ✓ Validation passed"));
  });

  it("should fail validation for empty contract", async () => {
    const state = createMockStateWithContract("");
    const auditState = createMockStateWithAudit(true, []);

    const combinedState = {
      ...state,
      ...auditState,
    };

    const result = await validateNode.execute(combinedState);

    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[VALIDATE] Validation failed"));
  });

  it("should fail validation when audit failed", async () => {
    const state = createMockStateWithContract("pragma solidity ^0.8.0; contract Test {}");
    const auditState = createMockStateWithAudit(false, ["Critical vulnerability"]);

    const combinedState = {
      ...state,
      ...auditState,
    };

    const result = await validateNode.execute(combinedState);

    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[VALIDATE] Validation failed"));
  });

  it("should fail validation for contract with selfdestruct", async () => {
    const contract = "pragma solidity ^0.8.0; contract Bad { function destroy() { selfdestruct(payable(0)); } }";
    const state = createMockStateWithContract(contract);
    const auditState = createMockStateWithAudit(true, []);

    const combinedState = {
      ...state,
      ...auditState,
    };

    const result = await validateNode.execute(combinedState);

    expect(result.status).toBe("processing");
    expect(result.logs).toContain(expect.stringContaining("[VALIDATE] Validation failed"));
  });

  it("should fail validation for contract with delegatecall", async () => {
    const contract = "pragma solidity ^0.8.0; contract Bad { function call() { (bool success, ) = address(0).delegatecall(\"\"); } }";
    const state = createMockStateWithContract(contract);
    const auditState = createMockStateWithAudit(true, []);

    const combinedState = {
      ...state,
      ...auditState,
    };

    const result = await validateNode.execute(combinedState);

    expect(result.status).toBe("processing");
  });
});

