import { describe, it, expect } from "vitest";
import {
  canTransitionSession,
  getTransitionEvent,
  isTerminalSessionState,
  getValidTransitionsFrom,
  type SessionState,
} from "./bridgeProtocol.js";

describe("canTransitionSession", () => {
  it("allows spawning to active", () => {
    expect(canTransitionSession("spawning", "active")).toBe(true);
  });

  it("allows spawning to terminated on error", () => {
    expect(canTransitionSession("spawning", "terminated")).toBe(true);
  });

  it("allows active to reconnecting", () => {
    expect(canTransitionSession("active", "reconnecting")).toBe(true);
  });

  it("allows active to draining", () => {
    expect(canTransitionSession("active", "draining")).toBe(true);
  });

  it("allows active to terminated on error", () => {
    expect(canTransitionSession("active", "terminated")).toBe(true);
  });

  it("allows reconnecting to active", () => {
    expect(canTransitionSession("reconnecting", "active")).toBe(true);
  });

  it("allows reconnecting to terminated on error", () => {
    expect(canTransitionSession("reconnecting", "terminated")).toBe(true);
  });

  it("allows draining to terminated", () => {
    expect(canTransitionSession("draining", "terminated")).toBe(true);
  });

  it("blocks terminated to any state", () => {
    const targets: SessionState[] = ["spawning", "active", "reconnecting", "draining"];
    for (const to of targets) {
      expect(canTransitionSession("terminated", to)).toBe(false);
    }
  });

  it("blocks active to spawning", () => {
    expect(canTransitionSession("active", "spawning")).toBe(false);
  });

  it("blocks draining to active", () => {
    expect(canTransitionSession("draining", "active")).toBe(false);
  });
});

describe("getTransitionEvent", () => {
  it("returns session_spawned for spawning to active", () => {
    expect(getTransitionEvent("spawning", "active")).toBe("session_spawned");
  });

  it("returns reconnect for active to reconnecting", () => {
    expect(getTransitionEvent("active", "reconnecting")).toBe("reconnect");
  });

  it("returns shutdown for active to draining", () => {
    expect(getTransitionEvent("active", "draining")).toBe("shutdown");
  });

  it("returns null for invalid transition", () => {
    expect(getTransitionEvent("terminated", "active")).toBeNull();
  });
});

describe("isTerminalSessionState", () => {
  it("terminated is terminal", () => {
    expect(isTerminalSessionState("terminated")).toBe(true);
  });

  it("active is not terminal", () => {
    expect(isTerminalSessionState("active")).toBe(false);
  });

  it("spawning is not terminal", () => {
    expect(isTerminalSessionState("spawning")).toBe(false);
  });
});

describe("getValidTransitionsFrom", () => {
  it("returns all valid transitions from active", () => {
    const transitions = getValidTransitionsFrom("active");
    expect(transitions.length).toBe(3);
    const targets = transitions.map((t) => t.to);
    expect(targets).toContain("reconnecting");
    expect(targets).toContain("draining");
    expect(targets).toContain("terminated");
  });

  it("returns empty for terminated", () => {
    expect(getValidTransitionsFrom("terminated")).toEqual([]);
  });

  it("returns 2 transitions from spawning", () => {
    const transitions = getValidTransitionsFrom("spawning");
    expect(transitions.length).toBe(2);
  });
});
