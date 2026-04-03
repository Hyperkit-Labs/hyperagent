import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./commandRegistry.js";

describe("CommandRegistry", () => {
  it("registers and lists commands", () => {
    const r = new CommandRegistry();
    r.register({
      id: "spec",
      method: "POST",
      path: "/agents/spec",
      description: "Spec agent",
      category: "agent",
    });
    expect(r.list()).toHaveLength(1);
    expect(r.get("spec")?.path).toBe("/agents/spec");
  });

  it("throws on duplicate id", () => {
    const r = new CommandRegistry();
    r.register({
      id: "a",
      method: "GET",
      path: "/a",
      description: "a",
      category: "internal",
    });
    expect(() =>
      r.register({
        id: "a",
        method: "GET",
        path: "/b",
        description: "b",
        category: "internal",
      }),
    ).toThrow(/duplicate command id/);
  });

  it("toDiscoveryJson omits undefined optional fields", () => {
    const r = new CommandRegistry();
    r.register({
      id: "health",
      method: "GET",
      path: "/health",
      description: "Health",
      category: "health",
    });
    const [row] = r.toDiscoveryJson();
    expect(row).not.toHaveProperty("featureFlag");
    expect(row).not.toHaveProperty("internalOnly");
  });
});
