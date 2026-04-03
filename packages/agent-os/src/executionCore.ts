/**
 * Execution core: turn lifecycle, budget enforcement, retry logic.
 * This is the single authoritative execution path contract.
 * The UI, SDK, and background workers all implement against these types.
 */

export const TURN_STATES = [
  "idle",
  "processing",
  "tool_call",
  "awaiting_approval",
  "completed",
  "failed",
  "budget_exceeded",
] as const;
export type TurnState = (typeof TURN_STATES)[number];

export interface ExecutionBudget {
  maxTurns: number;
  maxToolCalls: number;
  maxDurationMs: number;
  maxTokens: number;
}

export interface TurnRecord {
  turnIndex: number;
  promptTokens: number;
  completionTokens: number;
  toolCalls: number;
  durationMs: number;
}

export interface AccumulatedUsage {
  totalTurns: number;
  totalToolCalls: number;
  totalDurationMs: number;
  totalTokens: number;
}

export interface ExecutionPolicy {
  maxRetries: number;
  approvalRequiredTools: readonly string[];
  defaultBudget: ExecutionBudget;
}

export type BudgetExceededReason =
  | "max_turns"
  | "max_tool_calls"
  | "max_duration"
  | "max_tokens";

export function checkBudget(
  budget: ExecutionBudget,
  usage: AccumulatedUsage,
): BudgetExceededReason | null {
  if (usage.totalTurns >= budget.maxTurns) return "max_turns";
  if (usage.totalToolCalls >= budget.maxToolCalls) return "max_tool_calls";
  if (usage.totalDurationMs >= budget.maxDurationMs) return "max_duration";
  if (usage.totalTokens >= budget.maxTokens) return "max_tokens";
  return null;
}

export function canRetry(failureCount: number, maxRetries: number): boolean {
  return failureCount < maxRetries;
}

export function accumulateTurn(
  current: AccumulatedUsage,
  turn: TurnRecord,
): AccumulatedUsage {
  return {
    totalTurns: current.totalTurns + 1,
    totalToolCalls: current.totalToolCalls + turn.toolCalls,
    totalDurationMs: current.totalDurationMs + turn.durationMs,
    totalTokens: current.totalTokens + turn.promptTokens + turn.completionTokens,
  };
}

export function emptyUsage(): AccumulatedUsage {
  return { totalTurns: 0, totalToolCalls: 0, totalDurationMs: 0, totalTokens: 0 };
}

export function isTerminalTurnState(state: TurnState): boolean {
  return state === "completed" || state === "failed" || state === "budget_exceeded";
}

export function canTransitionTurn(from: TurnState, to: TurnState): boolean {
  if (isTerminalTurnState(from)) return false;

  const transitions: Record<string, readonly TurnState[]> = {
    idle: ["processing"],
    processing: ["tool_call", "awaiting_approval", "completed", "failed", "budget_exceeded"],
    tool_call: ["processing", "failed", "budget_exceeded"],
    awaiting_approval: ["processing", "failed"],
  };

  return (transitions[from] ?? []).includes(to);
}
