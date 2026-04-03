import { describe, it, expect } from "vitest";
import {
  validateAgentRole,
  canDelegate,
  type AgentRole,
  type DelegationRule,
} from "./agentContract.js";

function makeRole(overrides?: Partial<AgentRole>): AgentRole {
  return {
    id: "spec-agent",
    name: "Spec Agent",
    description: "Transforms natural language into structured spec",
    inputSchema: { type: "object", properties: { prompt: { type: "string" } } },
    outputSchema: { type: "object", properties: { spec: { type: "object" } } },
    delegationRules: [
      { targetAgentId: "design-agent", condition: "spec_complete", maxDepth: 2 },
    ],
    ...overrides,
  };
}

describe("validateAgentRole", () => {
  it("returns no errors for a valid role", () => {
    expect(validateAgentRole(makeRole())).toEqual([]);
  });

  it("requires id", () => {
    const errors = validateAgentRole(makeRole({ id: "" }));
    expect(errors.some((e) => e.field === "id")).toBe(true);
  });

  it("requires name", () => {
    const errors = validateAgentRole(makeRole({ name: "" }));
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("requires inputSchema to be an object", () => {
    const errors = validateAgentRole(makeRole({ inputSchema: null as unknown as Record<string, unknown> }));
    expect(errors.some((e) => e.field === "inputSchema")).toBe(true);
  });

  it("requires outputSchema to be an object", () => {
    const errors = validateAgentRole(makeRole({ outputSchema: undefined as unknown as Record<string, unknown> }));
    expect(errors.some((e) => e.field === "outputSchema")).toBe(true);
  });

  it("validates delegation rules have targetAgentId", () => {
    const badRule: DelegationRule = { targetAgentId: "", condition: "x", maxDepth: 1 };
    const errors = validateAgentRole(makeRole({ delegationRules: [badRule] }));
    expect(errors.some((e) => e.field.includes("targetAgentId"))).toBe(true);
  });

  it("validates delegation rules maxDepth is positive", () => {
    const badRule: DelegationRule = { targetAgentId: "a", condition: "x", maxDepth: 0 };
    const errors = validateAgentRole(makeRole({ delegationRules: [badRule] }));
    expect(errors.some((e) => e.field.includes("maxDepth"))).toBe(true);
  });
});

describe("canDelegate", () => {
  const role = makeRole({
    delegationRules: [
      { targetAgentId: "design-agent", condition: "spec_complete", maxDepth: 3 },
    ],
  });

  it("allows delegation within depth limit", () => {
    expect(canDelegate(role, "design-agent", 0)).toBe(true);
    expect(canDelegate(role, "design-agent", 2)).toBe(true);
  });

  it("blocks delegation at or beyond depth limit", () => {
    expect(canDelegate(role, "design-agent", 3)).toBe(false);
    expect(canDelegate(role, "design-agent", 5)).toBe(false);
  });

  it("blocks delegation to unknown agent", () => {
    expect(canDelegate(role, "unknown-agent", 0)).toBe(false);
  });
});
