import { describe, it, expect } from "vitest";
import {
  checkBudget,
  canRetry,
  accumulateTurn,
  emptyUsage,
  isTerminalTurnState,
  canTransitionTurn,
  type ExecutionBudget,
  type TurnRecord,
} from "./executionCore.js";

const budget: ExecutionBudget = {
  maxTurns: 10,
  maxToolCalls: 50,
  maxDurationMs: 60_000,
  maxTokens: 100_000,
};

describe("checkBudget", () => {
  it("returns null when within budget", () => {
    expect(
      checkBudget(budget, { totalTurns: 5, totalToolCalls: 20, totalDurationMs: 30_000, totalTokens: 50_000 }),
    ).toBeNull();
  });

  it("returns max_turns when turns exceeded", () => {
    expect(
      checkBudget(budget, { totalTurns: 10, totalToolCalls: 0, totalDurationMs: 0, totalTokens: 0 }),
    ).toBe("max_turns");
  });

  it("returns max_tool_calls when tool calls exceeded", () => {
    expect(
      checkBudget(budget, { totalTurns: 1, totalToolCalls: 50, totalDurationMs: 0, totalTokens: 0 }),
    ).toBe("max_tool_calls");
  });

  it("returns max_duration when duration exceeded", () => {
    expect(
      checkBudget(budget, { totalTurns: 1, totalToolCalls: 1, totalDurationMs: 60_000, totalTokens: 0 }),
    ).toBe("max_duration");
  });

  it("returns max_tokens when tokens exceeded", () => {
    expect(
      checkBudget(budget, { totalTurns: 1, totalToolCalls: 1, totalDurationMs: 1, totalTokens: 100_000 }),
    ).toBe("max_tokens");
  });
});

describe("canRetry", () => {
  it("allows retry when failure count is below max", () => {
    expect(canRetry(0, 3)).toBe(true);
    expect(canRetry(2, 3)).toBe(true);
  });

  it("blocks retry when at or above max", () => {
    expect(canRetry(3, 3)).toBe(false);
    expect(canRetry(5, 3)).toBe(false);
  });
});

describe("accumulateTurn", () => {
  it("adds turn metrics to accumulated usage", () => {
    const turn: TurnRecord = {
      turnIndex: 0,
      promptTokens: 100,
      completionTokens: 200,
      toolCalls: 3,
      durationMs: 1500,
    };
    const result = accumulateTurn(emptyUsage(), turn);
    expect(result).toEqual({
      totalTurns: 1,
      totalToolCalls: 3,
      totalDurationMs: 1500,
      totalTokens: 300,
    });
  });

  it("accumulates across multiple turns", () => {
    const t1: TurnRecord = { turnIndex: 0, promptTokens: 50, completionTokens: 50, toolCalls: 1, durationMs: 500 };
    const t2: TurnRecord = { turnIndex: 1, promptTokens: 100, completionTokens: 100, toolCalls: 2, durationMs: 1000 };
    const result = accumulateTurn(accumulateTurn(emptyUsage(), t1), t2);
    expect(result.totalTurns).toBe(2);
    expect(result.totalToolCalls).toBe(3);
    expect(result.totalTokens).toBe(300);
    expect(result.totalDurationMs).toBe(1500);
  });
});

describe("isTerminalTurnState", () => {
  it("recognizes terminal states", () => {
    expect(isTerminalTurnState("completed")).toBe(true);
    expect(isTerminalTurnState("failed")).toBe(true);
    expect(isTerminalTurnState("budget_exceeded")).toBe(true);
  });

  it("recognizes non-terminal states", () => {
    expect(isTerminalTurnState("idle")).toBe(false);
    expect(isTerminalTurnState("processing")).toBe(false);
    expect(isTerminalTurnState("tool_call")).toBe(false);
    expect(isTerminalTurnState("awaiting_approval")).toBe(false);
  });
});

describe("canTransitionTurn", () => {
  it("allows idle to processing", () => {
    expect(canTransitionTurn("idle", "processing")).toBe(true);
  });

  it("blocks idle to completed directly", () => {
    expect(canTransitionTurn("idle", "completed")).toBe(false);
  });

  it("allows processing to tool_call", () => {
    expect(canTransitionTurn("processing", "tool_call")).toBe(true);
  });

  it("allows processing to awaiting_approval", () => {
    expect(canTransitionTurn("processing", "awaiting_approval")).toBe(true);
  });

  it("allows tool_call back to processing", () => {
    expect(canTransitionTurn("tool_call", "processing")).toBe(true);
  });

  it("allows awaiting_approval to processing", () => {
    expect(canTransitionTurn("awaiting_approval", "processing")).toBe(true);
  });

  it("blocks transitions from terminal states", () => {
    expect(canTransitionTurn("completed", "idle")).toBe(false);
    expect(canTransitionTurn("failed", "processing")).toBe(false);
    expect(canTransitionTurn("budget_exceeded", "idle")).toBe(false);
  });
});
