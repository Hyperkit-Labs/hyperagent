import { describe, expect, it } from "vitest";
import { resolveToolExecution } from "./permissionPolicy.js";

describe("resolveToolExecution", () => {
  it("deny always blocks", () => {
    expect(
      resolveToolExecution("low", { mode: "deny", interactive: true }),
    ).toBe("block");
  });

  it("allow always executes", () => {
    expect(
      resolveToolExecution("high", { mode: "allow", interactive: false }),
    ).toBe("execute");
  });

  it("ask + interactive prompts", () => {
    expect(
      resolveToolExecution("high", { mode: "ask", interactive: true }),
    ).toBe("prompt");
  });

  it("ask + non-interactive executes only low risk", () => {
    expect(
      resolveToolExecution("low", { mode: "ask", interactive: false }),
    ).toBe("execute");
    expect(
      resolveToolExecution("high", { mode: "ask", interactive: false }),
    ).toBe("block");
  });
});
