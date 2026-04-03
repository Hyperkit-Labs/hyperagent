/**
 * Permission boundary: allow / ask / deny style resolution for tool and side-effect policy.
 */

export type PermissionMode = "allow" | "ask" | "deny";

export type RiskTier = "low" | "medium" | "high";

export interface PermissionContext {
  mode: PermissionMode;
  /** When false (e.g. background worker), "ask" cannot prompt and must fall back. */
  interactive: boolean;
}

export type ToolExecutionDecision = "execute" | "prompt" | "block";

/**
 * Resolves whether a side-effect should run, prompt, or block.
 * Background/non-interactive: "ask" maps to execute only for low risk, else block.
 */
export function resolveToolExecution(
  actionRisk: RiskTier,
  ctx: PermissionContext,
): ToolExecutionDecision {
  if (ctx.mode === "deny") {
    return "block";
  }
  if (ctx.mode === "allow") {
    return "execute";
  }
  if (ctx.mode === "ask") {
    if (ctx.interactive) {
      return "prompt";
    }
    return actionRisk === "low" ? "execute" : "block";
  }
  return "block";
}
