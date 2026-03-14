# Internal Boundaries

Route-to-service-to-module mapping. Enforces separation of concerns.

## Gateway (apps/api-gateway)

**Responsibility:** Auth bootstrap, JWT verification, rate limit, CORS, request-id injection, proxy.

**Routes:**
- `POST /api/v1/auth/bootstrap` -> gateway (authBootstrap)
- `GET /health` -> gateway
- `*` -> proxy to orchestrator

**No business logic** beyond bootstrap. All workflow, billing, deploy logic lives in orchestrator.

## Orchestrator (services/orchestrator)

**Responsibility:** Workflow lifecycle, pipeline invocation, BYOK resolution, billing, UI export, metrics.

**Modules:**
- `api/workflows.py` - CRUD, run status, streaming
- `api/pipeline.py` - start/continue pipeline, LangGraph wiring
- `api/billing.py` - credits, payments, spending controls
- `api/ui_export.py` - viem/wagmi dApp export
- `api/metrics_health.py` - metrics, health, integrations debug
- `domain/store.py` - workflow store, state persistence
- `domain/security.py` - policy evaluator, exploit sim glue

**Routes (delegated from main.py):**
- `/api/v1/workflows/*` -> api/workflows, api/pipeline
- `/api/v1/credits/*`, `/api/v1/payments/*` -> api/billing
- `/api/v1/workflows/{id}/ui-apps/export` -> api/ui_export
- `/api/v1/metrics`, `/health`, `/api/v1/config/integrations-debug` -> api/metrics_health

## Agent-Runtime (services/agent-runtime)

**Responsibility:** LLM agent execution only.

**Exposed:** `/agents/spec`, `/agents/design`, `/agents/codegen`, `/agents/test`, `/agents/autofix`, `/agents/estimate`, `/agents/pashov`, `/agents/oz-wizard`, `/health`.

**Removed (duplicates):** `/simulate`, `/simulate-bundle`, `/deploy`, `/pin`, `/ipfs/pin`, `/ipfs/unpin`. Use simulation, deploy, storage services instead.

## Simulation (services/simulation)

**Responsibility:** Tenderly simulation. Single entry point for simulate/simulate-bundle.

## Deploy (services/deploy)

**Responsibility:** Deploy plan generation. Single entry point for deploy plans.

## Storage (services/storage)

**Responsibility:** IPFS/Pinata pinning. Single entry point for all IPFS operations.

## Compile (services/compile)

**Responsibility:** Solidity compilation.

## Audit (services/audit)

**Responsibility:** Slither, Mythril, exploit detectors.

## CI Rule

No orchestrator code may import from `apps/studio` or `apps/api-gateway`. Only shared packages (packages/*).
