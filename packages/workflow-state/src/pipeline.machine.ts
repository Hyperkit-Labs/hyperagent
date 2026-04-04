import { assign, setup } from "xstate";
import type { PipelineUiBucket } from "./pipeline-states.js";
import { derivePipelineUiBucket } from "./pipeline-states.js";

/**
 * UI-side state machine: reflects orchestrator truth via SYNC events only.
 * Do not use this to drive server transitions; poll or subscribe, then dispatch SYNC.
 */
export const hyperagentPipelineUiMachine = setup({
  types: {
    context: {} as {
      stage: string | null;
      runStatus: string | null;
      bucket: PipelineUiBucket;
    },
    events: {} as
      | {
          type: "SYNC";
          stage: string | null;
          runStatus: string | null;
        }
      | { type: "RESET" },
  },
  actions: {
    applySync: assign({
      stage: ({ event }) => (event.type === "SYNC" ? event.stage : null),
      runStatus: ({ event }) => (event.type === "SYNC" ? event.runStatus : null),
      bucket: ({ event, context }) => {
        if (event.type !== "SYNC") {
          return context.bucket;
        }
        return derivePipelineUiBucket(event.stage, event.runStatus);
      },
    }),
    clear: assign({
      stage: () => null,
      runStatus: () => null,
      bucket: () => "idle" as const,
    }),
  },
}).createMachine({
  id: "hyperagentPipelineUi",
  initial: "idle",
  context: {
    stage: null,
    runStatus: null,
    bucket: "idle",
  },
  states: {
    idle: {
      on: {
        SYNC: { target: "tracking", actions: "applySync" },
      },
    },
    tracking: {
      on: {
        SYNC: { actions: "applySync" },
        RESET: { target: "idle", actions: "clear" },
      },
    },
  },
});
