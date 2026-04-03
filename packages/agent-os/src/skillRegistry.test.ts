import { describe, it, expect } from "vitest";
import {
  SkillRegistry,
  validateSkillDefinition,
  type SkillDefinition,
} from "./skillRegistry.js";

function makeSkill(overrides?: Partial<SkillDefinition>): SkillDefinition {
  return {
    id: "test-skill",
    name: "Test Skill",
    description: "A test skill",
    allowedTools: ["tool_a", "tool_b"],
    promptTemplate: "Do the thing with {{input}}",
    discoverable: true,
    permissionRequirements: { minimumRisk: "low", requiresApproval: false },
    ...overrides,
  };
}

describe("validateSkillDefinition", () => {
  it("returns no errors for a valid definition", () => {
    expect(validateSkillDefinition(makeSkill())).toEqual([]);
  });

  it("requires id", () => {
    const errors = validateSkillDefinition(makeSkill({ id: "" }));
    expect(errors.some((e) => e.field === "id")).toBe(true);
  });

  it("requires non-empty allowedTools", () => {
    const errors = validateSkillDefinition(makeSkill({ allowedTools: [] }));
    expect(errors.some((e) => e.field === "allowedTools")).toBe(true);
  });

  it("requires promptTemplate", () => {
    const errors = validateSkillDefinition(makeSkill({ promptTemplate: "" }));
    expect(errors.some((e) => e.field === "promptTemplate")).toBe(true);
  });

  it("requires discoverable to be boolean", () => {
    const errors = validateSkillDefinition({ ...makeSkill(), discoverable: undefined as unknown as boolean });
    expect(errors.some((e) => e.field === "discoverable")).toBe(true);
  });

  it("requires permissionRequirements", () => {
    const partial = { ...makeSkill() };
    delete (partial as Record<string, unknown>).permissionRequirements;
    const errors = validateSkillDefinition(partial);
    expect(errors.some((e) => e.field === "permissionRequirements")).toBe(true);
  });
});

describe("SkillRegistry", () => {
  it("registers and retrieves a skill", () => {
    const reg = new SkillRegistry();
    const skill = makeSkill();
    reg.register(skill);
    expect(reg.get("test-skill")).toEqual(skill);
  });

  it("rejects duplicate ids", () => {
    const reg = new SkillRegistry();
    reg.register(makeSkill());
    expect(() => reg.register(makeSkill())).toThrow(/duplicate skill id/);
  });

  it("rejects invalid definitions", () => {
    const reg = new SkillRegistry();
    expect(() => reg.register(makeSkill({ id: "" }))).toThrow(/invalid definition/);
  });

  it("lists all registered skills", () => {
    const reg = new SkillRegistry();
    reg.register(makeSkill({ id: "a" }));
    reg.register(makeSkill({ id: "b" }));
    expect(reg.list()).toHaveLength(2);
  });

  it("toDiscoveryJson filters non-discoverable skills", () => {
    const reg = new SkillRegistry();
    reg.register(makeSkill({ id: "pub", discoverable: true }));
    reg.register(makeSkill({ id: "priv", discoverable: false }));
    const discovery = reg.toDiscoveryJson();
    expect(discovery).toHaveLength(1);
    expect(discovery[0].id).toBe("pub");
  });

  it("returns undefined for unknown id", () => {
    const reg = new SkillRegistry();
    expect(reg.get("nope")).toBeUndefined();
  });
});
