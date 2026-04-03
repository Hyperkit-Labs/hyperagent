import { describe, expect, it } from "vitest";
import { canTransitionTask, isTerminalTaskState } from "./taskLifecycle.js";

describe("taskLifecycle", () => {
  it("detects terminal states", () => {
    expect(isTerminalTaskState("completed")).toBe(true);
    expect(isTerminalTaskState("pending")).toBe(false);
  });

  it("validates transitions", () => {
    expect(canTransitionTask("pending", "running")).toBe(true);
    expect(canTransitionTask("pending", "completed")).toBe(false);
    expect(canTransitionTask("running", "completed")).toBe(true);
    expect(canTransitionTask("completed", "running")).toBe(false);
  });
});
