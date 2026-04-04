# @hyperagent/workflow-state

Shared **pipeline stage types** and an **XState v5** UI machine that **mirrors** orchestrator state. The LangGraph pipeline on the server remains authoritative.

## Usage

The package exports TypeScript source. **hyperagent-studio** lists this package under `transpilePackages` in `next.config.ts`, so a separate build is not required for the app. Run `pnpm --filter @hyperagent/workflow-state run build` only when you need emitted `dist/` artifacts (for example checks or tooling outside Next).

```tsx
import { useMachine } from "@xstate/react";
import { hyperagentPipelineUiMachine } from "@hyperagent/workflow-state";

const [state, send] = useMachine(hyperagentPipelineUiMachine);
send({ type: "SYNC", stage: data.current_stage, runStatus: data.status });
```

See `docs/workflow-state-management.md`.
