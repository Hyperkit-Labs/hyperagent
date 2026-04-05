# Repository architecture map

This document ties **abstract agent-operating concepts** to **concrete locations** in the HyperAgent monorepo. It is the single map for how “command, skill, agent, task, plugin, permission, memory, control plane” language maps to code and docs.

## Layer model (hard taxonomy)

| Concept | Definition | Primary home in this repo |
|---------|------------|---------------------------|
| **Command** | User or tool entrypoint: one invocable action with a name and contract | **`@hyperagent/agent-os`** `CommandRegistry` in `packages/agent-os` (runtime discovery); `.cursor/commands/` (Cursor); CLI and Studio routes under `apps/studio/app/` |
| **Skill** | Reusable procedure: prompt + allowed tools + discovery metadata | `.cursor/skills/`, `skills/`, and `docs/planning/INSTALLED_SKILLS.md` index |
| **Agent** | Reasoning or execution role with a bounded responsibility | `services/agent-runtime/` (AI SDK host, tools); `services/orchestrator/` (LangGraph workflows); pipeline agents described in `CLAUDE.md` |
| **Task** | Tracked unit of work with lifecycle and terminal semantics | Orchestrator jobs (`services/orchestrator/worker.py`, queue usage); workflow/run records (control plane docs and DB tables referenced in project specs) |
| **Plugin** | Extension package that may register commands, skills, or integrations | Not a single runtime plugin host today: treat **MCP servers** (Cursor config) and **future** plugin manifests as this layer; see [plugin-trust-validation.md](plugin-trust-validation.md) |
| **Permission** | Explicit allow / ask / deny (and escalation) for tools, files, network | Studio session and wallet gates: `apps/studio/proxy.ts`, `apps/studio/components/auth/`, `apps/api-gateway/src/auth.ts`; product policy in [permission-approval-policy.md](permission-approval-policy.md) |
| **Memory** | Durable or session-scoped context with compaction boundaries | User/workspace keys and session storage: studio `lib/session-store.ts`, auth bootstrap; long-term memory services per `CLAUDE.md` (`services/context/` when present); traces/artifacts per storage policy |
| **Control plane** | Orchestration of sessions, workers, retries, and remote bridges separate from “doing the work” | `apps/api-gateway/` (edge auth, routing, rate limits); `services/orchestrator/` (graphs, queue); **execution plane** workers under `services/*` |

## Composition root (where “one place” should stay thin)

- **Registry pattern**: Command lists stay **enumerable and lazy-loadable** via `.cursor/commands/` and tooling; avoid stuffing business logic inside registry files. Registration only; logic lives in owned modules.
- **Execution core**: Conversation and tool orchestration for the product path should converge on **agent-runtime + orchestrator** rather than duplicating policy in Studio components. Studio owns UX; services own execution contracts.

## Studio vs services vs packages

| Area | Role |
|------|------|
| `apps/studio/` | Frontend shell: auth UI, workflow UX, API client usage |
| `apps/api-gateway/` | HTTP edge: auth, proxy to upstream services, rate limiting |
| `services/orchestrator/` | LangGraph pipelines, workers, queue integration |
| `services/agent-runtime/` | Vercel AI SDK agent host, tool wiring |
| `services/simulation/`, `services/deploy/`, `services/storage/` | Execution-plane specialists |
| `packages/core-types/`, `packages/backend-middleware/` | Shared types and HTTP middleware |

## Verification and observability (cross-cutting)

- **Verification** (distinct from unit tests): defined in [verification-methodology.md](verification-methodology.md); implemented per feature as API/UI/CLI/workflow checks with pass/fail and rerun rules.
- **Observability**: structured logging and health endpoints per service; gateway and workers should emit enough context to reconstruct a run (correlation IDs where implemented).

## Boundaries (anti-patterns to avoid)

- Do not merge **command registry** with **business logic** (fat registry).
- Do not collapse **permission state** into a single “god” store without ownership (split session vs trust vs task state).
- Do not encode policy **only** in comments; policy belongs in docs like this folder and in enforceable checks where feasible.

## Navigation

- **Index:** [README.md](README.md) (full list of agent operating model docs)
- Glossary: [glossary.md](glossary.md)
- High-risk paths: [high-risk-files.md](high-risk-files.md)
- Concepts: [agents.md](agents.md), [commands.md](commands.md), [bridge.md](bridge.md), [state-boundaries.md](state-boundaries.md)

---

**Index:** [Agent operating model](README.md)
