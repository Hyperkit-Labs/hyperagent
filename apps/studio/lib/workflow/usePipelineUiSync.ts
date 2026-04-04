"use client";

import { useMachine } from "@xstate/react";
import { hyperagentPipelineUiMachine } from "@hyperagent/workflow-state";
import { useEffect } from "react";

/**
 * Keeps the XState UI machine in sync with orchestrator workflow fields.
 * Pass latest `current_stage` and workflow `status` from your query or SSE payload.
 */
export function usePipelineUiSync(
  currentStage: string | null | undefined,
  runStatus: string | null | undefined,
) {
  const [state, send] = useMachine(hyperagentPipelineUiMachine);

  useEffect(() => {
    send({
      type: "SYNC",
      stage: currentStage ?? null,
      runStatus: runStatus ?? null,
    });
  }, [send, currentStage, runStatus]);

  return { state, send };
}
