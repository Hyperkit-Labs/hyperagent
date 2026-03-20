# AI tools

Vercel AI SDK tools: compile, audit, simulate, deploy. See `docs/detailed/Monorepo.md`.

**CI:** `pnpm test:ai-tools` (root) or `pnpm turbo run build test --filter=@hyperagent/ai-tools` runs the Tenderly bundle payload tests when PRs touch `packages/core-types`, `packages/ai-tools`, `services/agent-runtime`, `services/simulation`, or the agent-runtime Dockerfile (see `.github/workflows/ci.yml`).
