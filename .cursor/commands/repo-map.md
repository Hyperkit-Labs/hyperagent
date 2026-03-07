# /repo-map

Current repository structure and reference. Use this to orient agents and contributors.

## Current structure

- **apps/** – Applications
  - `studio/` – Next.js frontend (HyperAgent Studio). Primary user-facing app.
  - `api-gateway/` – Edge/API gateway (auth, routing, x402). Stub.
  - `docs/` – Documentation site. Stub.

- **services/** – Backend services (stubs; implement per spec)
  - `orchestrator/`, `agent-runtime/`, `codegen/`, `audit/`, `simulation/`, `deploy/`, `context/`, `storage/`

- **packages/** – Shared packages
  - `sdk-ts/`, `core-types/`, `web3-utils/`, `ai-tools/`, `ui/`, `config/` (some have minimal stubs for Studio)

- **contracts/** – Smart contracts
  - `evm/`, `templates/` (stubs)

- **infra/** – Infrastructure
  - `docker/` – Dockerfiles, docker-compose.
  - `terraform/` – IaC (Supabase, Redis, etc.).
  - `registries/` – GitOps-managed config-as-data: network/chains, sdks/sdks, x402/*, models, tokens, pipelines, security (YAML). Single source of truth; change via PR.
  - (No `k8s/`; removed.)

- **platform/** – Platform config
  - `supabase/`, `redis/`, `agents.md`

- **docs/** – Documentation
  - `README.md`, `getting-started.md`, `user-guide.md`, `developer-guide.md`, `specs/`, `adr/`, `runbooks/`

- **.cursor/** – Agent rules, commands, skills, LLM context

- **.github/** – Workflows, issue/PR templates, version/automation scripts if present

- **Root** – `package.json` (pnpm workspace), `pnpm-workspace.yaml`, `CLAUDE.md`, `CODEOWNERS`, config files

## Reference

Canonical monorepo layout and governance: see **docs/detailed/Monorepo.md** (or **external/docs/detailed/**) and **external/docs/detailed/draft.md** for platform blueprint, pipeline, and chain/SDK registries.

## Ownership

Review and sign-off are defined in **CODEOWNERS** (people/roles). Path-based auto-review can be added there if needed (e.g. `apps/*`, `services/*`, `docs/*`, `.cursor/*`).
