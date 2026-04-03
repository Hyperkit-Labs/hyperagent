/**
 * Explicit task types and terminal states for background and delegated work.
 */

export const TASK_STATES = ["pending", "running", "completed", "failed", "killed"] as const;
export type TaskState = (typeof TASK_STATES)[number];

export type TaskType = "local" | "remote" | "subagent" | "workflow" | "watchdog";

export function isTerminalTaskState(state: TaskState): boolean {
  return state === "completed" || state === "failed" || state === "killed";
}

export function canTransitionTask(from: TaskState, to: TaskState): boolean {
  if (from === "completed" || from === "failed" || from === "killed") {
    return false;
  }
  if (from === "pending") {
    return to === "running" || to === "killed";
  }
  if (from === "running") {
    return to === "completed" || to === "failed" || to === "killed";
  }
  return false;
}
