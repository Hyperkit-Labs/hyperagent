import { describe, it, expect } from "vitest";
import {
  validateManifest,
  type PluginManifest,
  type PluginTrustTier,
} from "./pluginManifest.js";

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    trustTier: "verified",
    capabilities: ["register_commands"],
    entrypoint: "./dist/index.js",
    permissions: ["read_files"],
    ...overrides,
  };
}

describe("validateManifest", () => {
  it("returns no errors for a valid manifest", () => {
    expect(validateManifest(makeManifest())).toEqual([]);
  });

  it("requires id", () => {
    const errors = validateManifest(makeManifest({ id: "" }));
    expect(errors.some((e) => e.field === "id")).toBe(true);
  });

  it("requires name", () => {
    const errors = validateManifest(makeManifest({ name: "" }));
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("requires semver version", () => {
    expect(validateManifest(makeManifest({ version: "abc" })).some((e) => e.field === "version")).toBe(true);
    expect(validateManifest(makeManifest({ version: "1.0.0" }))).toEqual([]);
    expect(validateManifest(makeManifest({ version: "2.1.3-beta.1" }))).toEqual([]);
  });

  it("requires valid trustTier", () => {
    const errors = validateManifest(makeManifest({ trustTier: "unknown" as PluginTrustTier }));
    expect(errors.some((e) => e.field === "trustTier")).toBe(true);
  });

  it("requires entrypoint", () => {
    const errors = validateManifest(makeManifest({ entrypoint: "" }));
    expect(errors.some((e) => e.field === "entrypoint")).toBe(true);
  });

  it("requires non-empty capabilities array", () => {
    const errors = validateManifest(makeManifest({ capabilities: [] }));
    expect(errors.some((e) => e.field === "capabilities")).toBe(true);
  });

  it("rejects unknown capabilities", () => {
    const errors = validateManifest(
      makeManifest({ capabilities: ["register_commands", "fly_rockets" as never] }),
    );
    expect(errors.some((e) => e.message.includes("fly_rockets"))).toBe(true);
  });

  it("enforces trust tier capability restrictions", () => {
    const errors = validateManifest(
      makeManifest({ trustTier: "session", capabilities: ["inject_mcp"] }),
    );
    expect(errors.some((e) => e.message.includes("inject_mcp") && e.message.includes("session"))).toBe(true);
  });

  it("allows inject_mcp for verified tier", () => {
    const errors = validateManifest(
      makeManifest({ trustTier: "verified", capabilities: ["inject_mcp"] }),
    );
    expect(errors).toEqual([]);
  });

  it("allows inject_mcp for local tier", () => {
    const errors = validateManifest(
      makeManifest({ trustTier: "local", capabilities: ["inject_mcp"] }),
    );
    expect(errors).toEqual([]);
  });

  it("blocks inject_mcp for marketplace tier", () => {
    const errors = validateManifest(
      makeManifest({ trustTier: "marketplace", capabilities: ["inject_mcp"] }),
    );
    expect(errors.some((e) => e.message.includes("inject_mcp"))).toBe(true);
  });

  it("requires permissions to be an array", () => {
    const errors = validateManifest(
      makeManifest({ permissions: undefined as unknown as readonly string[] }),
    );
    expect(errors.some((e) => e.field === "permissions")).toBe(true);
  });
});
