"use client";

import { useId } from "react";
import {
  FileText,
  Layout,
  Code,
  Search,
  Shield,
  TestTube,
  Bug,
  Rocket,
  Loader2,
  Check,
  X,
} from "lucide-react";
import type { Workflow } from "@/lib/types";
import { StepperTrail } from "@/components/ui";

const STAGE_ICONS: Record<string, React.ReactNode> = {
  spec: <FileText className="w-3.5 h-3.5" />,
  design: <Layout className="w-3.5 h-3.5" />,
  codegen: <Code className="w-3.5 h-3.5" />,
  scrubd: <Search className="w-3.5 h-3.5" />,
  audit: <Shield className="w-3.5 h-3.5" />,
  simulation: <TestTube className="w-3.5 h-3.5" />,
  exploit_sim: <Bug className="w-3.5 h-3.5" />,
  deploy: <Rocket className="w-3.5 h-3.5" />,
};

const PIPELINE_ORDER = [
  "spec",
  "design",
  "codegen",
  "scrubd",
  "audit",
  "simulation",
  "exploit_sim",
  "deploy",
];

function normalizeStatus(
  s: string,
): "completed" | "failed" | "processing" | "pending" {
  const lower = s.toLowerCase();
  if (lower === "completed" || lower === "done" || lower === "success")
    return "completed";
  if (lower === "failed" || lower === "error") return "failed";
  if (
    lower === "processing" ||
    lower === "running" ||
    lower === "building" ||
    lower === "in_progress"
  )
    return "processing";
  return "pending";
}

export interface PipelineStepperProps {
  workflow: Workflow | null;
  onErrorClick?: (stageName: string, error?: string) => void;
  className?: string;
}

export function PipelineStepper({
  workflow,
  onErrorClick,
  className = "",
}: PipelineStepperProps) {
  const liveRegionId = useId();
  if (!workflow) return null;

  const backendStages = workflow.stages || [];
  const stageMap = new Map(
    backendStages.map(
      (s: {
        name?: string;
        stage?: string;
        status?: string;
        error?: string;
      }) => [s.name ?? s.stage ?? "", s],
    ),
  );

  const workflowFailed = workflow.status === "failed";
  const isRunning =
    workflow.status === "running" ||
    workflow.status === "building" ||
    workflow.status === "spec_review" ||
    workflow.status === "design_review";

  const steps = PIPELINE_ORDER.map((name) => {
    const stage = stageMap.get(name) as
      | { status?: string; error?: string }
      | undefined;
    let status: "completed" | "failed" | "processing" | "pending" = stage
      ? normalizeStatus(stage.status ?? "pending")
      : "pending";

    if (!stage && isRunning) {
      const idx = PIPELINE_ORDER.indexOf(name);
      const prevDone =
        idx > 0 &&
        PIPELINE_ORDER.slice(0, idx).every((prev) => {
          const p = stageMap.get(prev) as { status?: string } | undefined;
          return p && (p.status === "completed" || p.status === "done");
        });
      if (prevDone) status = "processing";
      else if (idx === 0) status = "processing";
    }

    if (workflowFailed && status === "pending" && !stage) {
      const idx = PIPELINE_ORDER.indexOf(name);
      const prevAllDone =
        idx > 0 &&
        PIPELINE_ORDER.slice(0, idx).every((prev) => {
          const p = stageMap.get(prev) as { status?: string } | undefined;
          return p && (p.status === "completed" || p.status === "done");
        });
      if (prevAllDone) status = "failed";
    }

    return {
      name,
      label: name.replace(/_/g, " "),
      status,
      error: stage?.error,
      icon: STAGE_ICONS[name] ?? <Code className="w-3.5 h-3.5" />,
    };
  });

  const processingLabels = steps
    .filter((s) => s.status === "processing")
    .map((s) => s.label);
  const failedLabels = steps
    .filter((s) => s.status === "failed")
    .map((s) => s.label);
  const liveParts = [
    `Workflow status ${workflow.status}`,
    processingLabels.length > 0
      ? `In progress: ${processingLabels.join(", ")}`
      : null,
    failedLabels.length > 0 ? `Failed: ${failedLabels.join(", ")}` : null,
  ].filter(Boolean);

  const trailCurrent = steps.findIndex((s) => s.status === "processing");
  const trailFailed = steps.findIndex((s) => s.status === "failed");
  const completedAll = steps.every((s) => s.status === "completed");
  const firstOpen = steps.findIndex(
    (s) => s.status !== "completed" && s.status !== "failed",
  );
  const currentTrailIndex =
    trailCurrent >= 0
      ? trailCurrent
      : trailFailed >= 0
        ? trailFailed
        : completedAll
          ? steps.length
          : firstOpen >= 0
            ? firstOpen
            : 0;
  const trailSteps = steps.map((s) => ({
    id: s.name,
    label: s.label,
  }));

  return (
    <>
      <p
        id={liveRegionId}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveParts.join(". ")}
      </p>
      <div className={`space-y-2 ${className}`.trim()}>
        <StepperTrail steps={trailSteps} currentIndex={currentTrailIndex} />
        <div
          className="flex items-center gap-1 overflow-x-auto py-2 px-3 rounded-lg bg-[var(--color-bg-elevated)]/80 backdrop-blur-sm border border-[var(--color-border-subtle)]"
          aria-describedby={liveRegionId}
        >
          {steps.map((step, i) => (
            <div key={step.name} className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() =>
                  step.status === "failed" && step.error && onErrorClick
                    ? onErrorClick(step.name, step.error)
                    : undefined
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  step.status === "failed"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15"
                    : step.status === "processing"
                      ? "bg-[var(--color-primary-alpha-15)] border border-[var(--color-primary-alpha-20)] text-[var(--color-primary-light)]"
                      : step.status === "completed"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "bg-[var(--color-bg-panel)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]"
                }`}
                title={step.status === "failed" ? step.error : step.label}
              >
                {step.status === "processing" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : step.status === "completed" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : step.status === "failed" ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  step.icon
                )}
                <span className="text-[11px] font-medium capitalize">
                  {step.label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <div
                  className="w-4 h-px bg-[var(--color-border-subtle)] mx-0.5 shrink-0"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
