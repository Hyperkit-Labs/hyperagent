/**
 * Canonical pipeline stage strings produced by the orchestrator LangGraph graph.
 * Keep in sync with services/orchestrator nodes and workflow responses.
 * Studio maps these for UX; the server remains source of truth.
 */
export const PIPELINE_STAGES = [
  "spec",
  "design",
  "codegen",
  "audit",
  "simulation",
  "deploy",
  "ui_scaffold",
  "human_review",
  "awaiting_deploy_approval",
  "deployed",
  "failed",
  "audit_failed",
  "simulation_failed",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number] | string;

/** Coarse UI bucket for XState and layout (derived from stage + status). */
export type PipelineUiBucket =
  | "idle"
  | "active"
  | "blocked"
  | "succeeded"
  | "failed";

export function derivePipelineUiBucket(
  currentStage: string | null | undefined,
  runStatus: string | null | undefined,
): PipelineUiBucket {
  const stage = (currentStage || "").toLowerCase();
  const status = (runStatus || "").toLowerCase();

  if (status === "failed" || stage.endsWith("_failed") || stage === "failed") {
    return "failed";
  }
  if (
    status === "completed" ||
    stage === "deployed" ||
    stage === "deploy" ||
    stage === "ui_scaffold"
  ) {
    return "succeeded";
  }
  if (
    stage === "human_review" ||
    stage === "awaiting_deploy_approval" ||
    stage.includes("approve")
  ) {
    return "blocked";
  }
  if (!stage && !status) {
    return "idle";
  }
  return "active";
}
