# Production Hardening Roadmap

This document turns the current gap inventory into a production program for HyperAgent. It is intentionally biased toward Phase 1 reliability, correctness, and safety over feature expansion.

## Goal

Make the repo production-grade for the primary Phase 1 path:

`Studio -> API gateway -> orchestrator -> compile/audit/simulation/deploy/storage -> Supabase/IPFS/Tenderly`

Production-grade here means:

- The primary workflow is real end to end on the MVP chain
- Failures are explicit, observable, and recoverable
- Security-sensitive paths are fail-closed
- Docs and UI claims match implemented behavior
- CI proves the path before merge and before release

## Current maturity snapshot

### Strongest areas

- Studio app and gateway are substantial and wired into the orchestrator
- Orchestrator owns a real workflow graph, router surface, billing/BYOK/storage hooks, and test suites
- Compile and audit services have real implementations
- Supabase schema, RLS, and workflow persistence are materially implemented
- Registries are well-structured and provide a good config-as-data foundation

### Main production blockers

- Some services and packages are partial, stubbed, or roadmap-level only
- Local/dev composition collapses some conceptual service boundaries, which can hide production issues
- Documentation and claims still overstate some capabilities
- Several critical workflows are optional-by-env rather than enforced-by-platform
- Shared packages are uneven; some are mature, others are placeholders
- The repo lacks a single hard production gate proving the exact MVP path on every release

## Workstreams

### 1. Narrow to one shippable MVP path

Scope:

- Freeze a single supported chain and deployment lane for Phase 1
- Freeze one supported workflow path from prompt to deploy preparation
- Freeze one auth model, one BYOK model, one storage path, and one simulation path

Why:

- The repo contains multi-chain and multi-surface ambition, but production quality comes from reducing the supported matrix first

Exit criteria:

- One chain is marked `primary` and is the only release-blocking target
- Non-MVP chains are clearly marked experimental or roadmap in UI, docs, and registries
- One canonical workflow is covered by CI, staging, and release verification

### 2. Convert honesty gaps into explicit contracts

Scope:

- Resolve all `STUB`, `PARTIAL`, `CLAIMED NOT IMPLEMENTED`, `USER-VISIBLE NOT ENFORCED`, and `ARCHITECTED ONLY` items from [capability truth table](capability-truth-table.md)
- Remove or relabel claims that exceed runtime guarantees
- Add machine-checkable assertions where possible

Why:

- Production systems fail hardest where the UI or docs imply guarantees the backend does not actually enforce

Priority targets:

- ERC-8004 sync/indexing posture
- Audit “mandatory” wording versus actual deploy/runtime guarantees
- Multi-chain readiness claims
- Filecoin/durable storage claims
- Observability/dashboard claims

Exit criteria:

- Every major customer-facing capability is classified as `enforced`, `optional`, or `roadmap`
- README, Studio copy, docs, and API behavior all agree
- No endpoint returns theater success for unimplemented behavior

### 3. Harden the orchestrator as the control plane

Scope:

- Audit every router and workflow transition in `services/orchestrator`
- Remove implicit in-memory fallbacks from production-sensitive paths
- Make checkpointing, state persistence, and replay behavior deterministic
- Standardize idempotency, retry, timeout, and circuit-breaker behavior

Why:

- The orchestrator is the blast-radius center of the platform

Priority targets:

- `main.py`, `workflow.py`, `store.py`, `trace_writer.py`, `queue_client.py`, `workflow_state.py`
- Startup validation and degraded-mode semantics
- Resume and approval boundaries around deploy

Exit criteria:

- Every state transition has an expected persisted record and failure mode
- Queue/checkpointer/storage behavior is explicit in production
- Retries do not create duplicate billing, duplicate steps, or phantom deployments

### 4. Make all critical security paths fail-closed

Scope:

- Review auth, BYOK, internal service auth, x402, deploy gating, simulation gating, waiver handling, and storage verification
- Remove production bypasses that exist for convenience in development
- Add negative tests for compromised or malformed inputs

Why:

- Security-sensitive workflows should never silently degrade into permissive behavior

Priority targets:

- Gateway auth and bootstrap flow
- `X-Agent-Session` and `X-Internal-Token` handling
- Identity HMAC enforcement
- Tenderly-required deployment enforcement
- BYOK encryption/KMS strict mode
- Waiver signing and verification

Exit criteria:

- Missing secrets/config in production either block startup or return explicit unhealthy status
- Auth, metering, and deploy protections have regression tests
- No body-only or legacy fallback path bypasses enforced auth in production

### 5. Upgrade service boundaries from “present” to “operational”

Scope:

- Evaluate each service as a deployable unit with health, auth, observability, retry behavior, and ownership
- Decide which services stay independent versus which are intentionally folded into `agent-runtime`

Services to review:

- `agent-runtime`
- `compile`
- `audit`
- `simulation`
- `deploy`
- `storage`
- `context`
- `vectordb`
- `hyperagent-tools`
- `sandbox-docker`
- `roma-service`
- `codegen`

Why:

- Several services are real, but not all are equally production-ready as independent operational units

Exit criteria:

- Each service is labeled `production`, `internal-only`, `dev-only`, or `roadmap`
- Every production service has health checks, auth model, runbook, and deployment manifest
- Services that are still stubs are either completed or removed from the supported architecture

### 6. Finish the data plane and provenance story

Scope:

- Make `runs`, `run_steps`, logs, artifacts, traces, and storage reconciliation production-reliable
- Ensure every blob/reference has a clear source of truth and verification lifecycle
- Remove stub trace identifiers from production outcomes

Why:

- Verifiability is a core product claim

Priority targets:

- `trace_writer.py`
- storage webhooks and reconciliation
- Pinata upload and retrieval verification
- Filecoin/EigenDA behavior and claims

Exit criteria:

- A completed run always shows whether traces are verifiable
- Artifact storage status is queryable and auditable
- Production cannot mark unverifiable traces as complete success

### 7. Bring shared packages to one of two states: real or removed

Scope:

- Audit all packages under `packages/`
- Finish packages that are part of the MVP runtime contract
- Archive or clearly label placeholder packages that are not yet real

Packages needing special scrutiny:

- `sdk-ts`
- `core-types`
- `ui`
- `contract-validation`
- `execution-backend`
- `schema-registry`

Why:

- Placeholder packages create false architectural confidence and confuse ownership

Exit criteria:

- Each package has one of: real source + tests, generated artifact contract, or explicit placeholder status
- Package boundaries match actual imports and runtime use

### 8. Make Studio reflect reality precisely

Scope:

- Review all major app surfaces in `apps/studio/app` and `apps/studio/components`
- Hide, relabel, or gate functionality that is not truly production-backed
- Ensure workflow states shown in the UI map to orchestrator truth

Priority surfaces:

- Agents
- Deployments
- Payments
- Monitoring
- Networks
- Settings/BYOK
- Workflow runs and stages

Why:

- A production UI must not suggest guarantees the backend cannot prove

Exit criteria:

- Every visible action maps to a real backend capability
- Partial features are labeled as preview/experimental
- Workflow stage rendering is driven by canonical state, not optimistic assumptions

### 9. Turn CI into a real release gate

Scope:

- Add release-blocking checks for the MVP path
- Separate fast checks from full acceptance checks
- Ensure docs/schema/registry drift is caught automatically

Required gates:

- Typecheck, lint, unit tests
- Contract compile/tests
- Orchestrator integration tests
- Gateway auth chain tests
- Supabase schema/RLS verification
- Minimal end-to-end workflow test against a real composed stack
- Docs honesty checks for capability tables and public claims

Exit criteria:

- A pull request cannot merge without proving the primary path
- A release cannot ship without a staging acceptance run

### 10. Operationalize deployment, monitoring, and incident response

Scope:

- Turn observability from “hooks exist” into “operators can detect and respond”
- Finalize alerts, dashboards, SLOs, and runbooks

Required production outputs:

- Request/run/step correlation across gateway, orchestrator, and services
- Service health dashboards
- Error budget/SLO reporting for the MVP path
- Alerts for auth failures, audit failures, storage failures, simulation skips, and deploy policy violations

Exit criteria:

- A new engineer can diagnose a failed run using dashboards and logs
- A runbook exists for each Sev1/Sev2 failure class

## Execution order

### Phase A: Truth and scope lock

1. Freeze the MVP chain and exact supported path
2. Resolve honesty gaps in docs, UI labels, and API behavior
3. Mark non-production services and packages explicitly

### Phase B: Control-plane hardening

1. Orchestrator workflow/state/idempotency review
2. Security fail-closed review
3. Persistence and provenance hardening

### Phase C: Service operational readiness

1. Compile/audit/runtime/deploy/storage promotion
2. Context/vectordb/sandbox/roma/codegen decisions: finish, fold in, or demote
3. Shared package cleanup

### Phase D: Release engineering

1. CI and staging acceptance gates
2. Dashboards, alerts, and runbooks
3. Production cutover checklist

## Suggested issue epics

- Epic 1: MVP scope lock and capability truth alignment
- Epic 2: Orchestrator production hardening
- Epic 3: Auth, BYOK, and deploy security hardening
- Epic 4: Compile/audit/simulation/deploy service readiness
- Epic 5: Storage, trace provenance, and artifact verification
- Epic 6: Studio truthfulness and workflow UX hardening
- Epic 7: Shared package rationalization
- Epic 8: CI/CD and release gating
- Epic 9: Observability and incident response

## Definition of done for “production-grade”

HyperAgent is production-grade for Phase 1 only when all of the following are true:

- The MVP workflow succeeds reliably on the primary chain
- The workflow is covered by repeatable CI and staging verification
- Security-critical paths are fail-closed in production
- Run state, artifacts, traces, and billing are auditable
- Docs and UI make no unsupported promises
- Operators have sufficient telemetry and runbooks to diagnose failures

## Immediate next actions

1. Convert `docs/control-plane/capability-truth-table.md` into a tracked issue backlog with owners and severities
2. Lock the Phase 1 chain/support matrix in registries, docs, and Studio copy
3. Perform a file-by-file orchestrator hardening review
4. Promote or demote each service and package based on actual production readiness
5. Add one release-blocking end-to-end acceptance job for the MVP path
