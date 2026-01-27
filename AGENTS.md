# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## What this repo is
HyperAgent is a multi-service “AI-powered smart contract development” system:
- **Python backend (FastAPI)**: primary API under `/api/v1/*`, workflow execution, DB access, websocket updates.
- **Frontend (Next.js)**: UI in `frontend/`.
- **TypeScript orchestrator (spec-locked)**: state machine in `ts/orchestrator/` plus an HTTP API in `ts/api/`.
- **x402 verifier service (TypeScript)**: payment verification wrapper around Thirdweb in `services/x402-verifier/`.

## Common commands

### Docker Compose (full local stack)
From repo root:
- Start everything:
  - `docker compose up -d --build`
- Follow logs:
  - `docker compose logs -f`
- Stop:
  - `docker compose down`

Makefile shortcuts (if you have `make` installed):
- `make up` (runs `docker-compose up -d`)
- `make logs`
- `make migrate` (runs `alembic upgrade head` inside the backend container)
- `make test` (runs `pytest tests/ -v` inside the backend container)

Note: `Makefile` contains `make up-prod` but this repo does **not** include `docker-compose.prod.yml`.

### Python backend (FastAPI)
Install + run locally (no Docker):
- Create venv:
  - `python -m venv venv`
  - Windows PowerShell: `venv\Scripts\Activate.ps1`
  - macOS/Linux: `source venv/bin/activate`
- Install deps:
  - `pip install -r requirements.txt`
- Apply DB migrations:
  - `alembic upgrade head`
- Run API (dev):
  - `uvicorn hyperagent.api.main:app --reload`

Tests:
- Run all tests:
  - `pytest -v`
- Run a subset:
  - `pytest tests/unit -v`
  - `pytest tests/integration -v`
  - `pytest tests/e2e -v`
- Run a single test file:
  - `pytest tests/unit/test_foo.py -v`
- Run a single test case:
  - `pytest tests/unit/test_foo.py::test_some_behavior -v`
  - `pytest -k "some_behavior" -v`

Lint/format/typecheck:
- `black hyperagent/`
- `isort hyperagent/`
- `mypy hyperagent/`

Pre-commit hooks:
- `pre-commit install`
- `pre-commit run --all-files`

### Frontend (Next.js)
From `frontend/`:
- Install:
  - `npm ci`
- Dev server:
  - `npm run dev`
- Lint / format:
  - `npm run lint`
  - `npm run format`
- Tests:
  - `npm test`
  - Single test file/pattern: `npm test -- <pattern>`

The frontend expects the Python API at `http://localhost:8000` (see `frontend/README.md`).

### TypeScript orchestrator + TS API
From `ts/orchestrator/`:
- Install/build:
  - `npm ci`
  - `npm run build`
- Lint/test:
  - `npm run lint`
  - `npm test`

From `ts/api/`:
- Install/build/run:
  - `npm ci`
  - `npm run dev` (dev server)
  - `npm run build && npm start` (prod)

Docker Compose can run the TS API as `ts-orchestrator` (see `docker-compose.yml`, port `4000`).

### Spec drift (TS canonical → schema + Python models)
The orchestrator state shape is treated as **canonical in TypeScript** (`ts/orchestrator/src/core/spec/state.ts`).

When changing that state spec, regenerate and ensure no diffs:
- `bash scripts/spec/check_spec_drift.sh`

What it does:
- Generates `schema/hyperagent_state.schema.json` from `ts/orchestrator` (`npm run schema:generate`).
- Generates Python Pydantic v2 models into `hyperagent/core/generated_spec/hyperagent_state.py`.

(These scripts require a Bash environment; on Windows that usually means Git Bash or WSL.)

### x402 verifier service
From `services/x402-verifier/`:
- Install/run:
  - `npm ci`
  - `npm run dev`
- Lint:
  - `npm run lint`

## High-level architecture (big picture)

### Python backend request flow
- **Entry point**: `hyperagent/api/main.py`
  - Registers routers under `/api/v1/*` (docs at `/api/v1/docs`).
  - Websocket updates at `/ws/workflow/{workflow_id}`.
- **Workflow creation**: `hyperagent/api/routes/workflows.py`
  - `POST /api/v1/workflows/generate` creates a DB workflow record and starts an async background task.
  - `wallet_address` is required for workflow creation and for deployment-related stages.
  - Supports modular execution via `selected_tasks` (generation/compilation/audit/testing/deployment).
- **Orchestration**: `hyperagent/core/orchestrator.py` + `hyperagent/architecture/soa.py`
  - Builds a pipeline (based on `selected_tasks`) and runs it through a sequential orchestrator.
  - Services are registered by name in `ServiceRegistry`.
- **Service layer** (examples):
  - `hyperagent/core/services/generation_service.py`: LLM + template retrieval (optionally routed via `MultiModelRouter`), optional “memory” integration.
  - `hyperagent/core/services/audit_service.py`: security auditing (Slither via `SecurityAuditor`).
  - `hyperagent/core/services/deployment_service.py`: handles user-signed deployments and (non-x402) gasless facilitator flows.
- **Events/progress**: `hyperagent/events/event_bus.py`
  - Uses Redis Streams when available with an in-memory fallback.

### Persistence
- Postgres access is via async SQLAlchemy session factory in `hyperagent/db/session.py`.
- Migrations are managed by Alembic under `alembic/`.

### x402 (payments) integration
- Python backend has x402-related routes under `hyperagent/api/routes/x402/`.
- Payment verification is delegated to the TypeScript service in `services/x402-verifier/` (also wired in `docker-compose.yml`).

### TS orchestrator (spec-locked)
- The “DNA blueprint” lives in `docs/hyperagent_dna_blueprint.md`.
- Canonical state spec: `ts/orchestrator/src/core/spec/state.ts`.
- Generated artifacts:
  - `schema/hyperagent_state.schema.json`
  - `hyperagent/core/generated_spec/hyperagent_state.py`
- TS API server: `ts/api/src/server.ts`
  - Routes in `ts/api/src/routes/*` (notably `/api/v2/workflows`).
  - During migration, TS code can call the Python backend via `ts/api/src/clients/pythonBackend.ts`.

## Where to look for deeper design docs
- `docs/README.md` is an index into architecture/planning documents.
- Additional refactor/blueprint materials live under `Hyperagent Refactor/Hyperagent Plan/` (including `BLUEPRINT_PLAYBOOK_COMBINED.md`).
