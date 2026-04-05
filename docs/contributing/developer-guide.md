# Contributor guide

Setup and workflow for developing and contributing to HyperAgent.

---

## Repo structure

The repository is a monorepo (pnpm workspaces). Main areas:

| Path | Purpose |
|------|---------|
| `apps/studio` | Next.js frontend (HyperAgent Studio). Primary application for Studio usage. |
| `apps/api-gateway` | API gateway (auth, rate limit, proxy to orchestrator). Runs on port 4000. |
| `services/orchestrator` | Python/FastAPI backend. Workflows, runs, networks, BYOK, deploy plans. |
| `services/agent-runtime` | Agent runtime (simulation, deploy, storage). Used by orchestrator. |
| `services/compile` | Solidity compilation service. |
| `services/audit` | Security audit service (Slither, Mythril). |
| `packages/*` | Shared packages and schemas. Real runtime examples include `core-types`, `config`, `workflow-state`, `web3-utils`, `ai-tools`, and **`agent-os`**. Some roadmap placeholders remain explicitly labeled in-package (for example `sdk-ts`, `shared-ui`). |
| `infra/registries` | Chain registry (`network/chains.yaml`), x402 config. |
| `infra/docker` | Docker Compose for backend stack. |
| `platform/supabase` | Supabase migrations (runs, run_steps, wallet_users, etc.). |
| `docs/` | Public documentation (onboarding, Studio guide, contributor guide). |

---

## Prerequisites

- **Node.js** 18+
- **pnpm** 8+
- **Git**
- (Optional) **Python** 3.11+, **Docker** for backend and infra

---

## Local setup

1. **Clone and install**
   ```bash
   git clone https://github.com/Hyperkit-Labs/hyperagent.git
   cd hyperagent
   pnpm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env` at repo root.
   - For Studio: set `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_API_URL` (for example `http://localhost:4000` when using gateway).
   - For backend: set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (gateway rate limits), and `REDIS_URL` (TCP for orchestrator queue and checkpointer when enabled).

3. **Run backend (Docker)**
   ```bash
   make up
   ```
   Gateway: http://localhost:4000. Orchestrator runs behind the gateway.

4. **Run Studio**
   ```bash
   pnpm --filter hyperagent-studio dev
   ```
   Or:
   ```bash
   cd apps/studio && pnpm dev
   ```
   App: [http://localhost:3000](http://localhost:3000).

5. **Optional: full stack**
   - `make up-full` – includes roma-service, codegen (legacy).
   - `make up-tools` – adds hyperagent-tools on port 9000.
   - `make up-local` – local postgres, redis, vectordb.

---

## Commands (monorepo)

From repo root:

```bash
pnpm install                    # Install all workspace deps
pnpm --filter hyperagent-studio dev    # Run Studio dev server
pnpm --filter hyperagent-studio build  # Build Studio
pnpm turbo lint                 # Lint
pnpm turbo test                 # Test
```

Backend (Makefile):

```bash
make up         # Start lite backend (5–6 services)
make down       # Stop stack
make restart    # Restart stack
make logs       # Follow logs
make run-web    # Start Studio (after make up)
```

---

## Contributing

1. Fork the repo and create a branch (`feature/...` or `fix/...`).
2. Make changes. Follow existing code style and run lint/tests.
3. Commit with clear messages (for example `feat: ...`, `fix: ...`).
4. Push and open a Pull Request. Fill in the PR template if present.
5. Address review feedback. Merge when approved and checks pass.

See [Contributing](contributing.md) for the public contribution guidelines used by the docs site.

---

## Agent OS (runtime primitives)

Shared library **`@hyperagent/agent-os`** (`packages/agent-os`): command registry metadata, task lifecycle states, and permission resolution (`resolveToolExecution`). The **agent runtime** registers every HTTP command and exposes discovery at **`GET /registry/commands`** (same auth as other agent routes: `X-Agent-Session` or `X-Internal-Token`). Use that JSON from orchestration or internal tooling to enumerate paths and methods without scraping code.

## Related docs

- **Onboarding:** [Getting started](../introduction/getting-started.md)
- **Studio usage:** [Studio guide](../product/user-guide.md)
- **Architecture:** [Network architecture](../architecture/networks.md), [Control plane](../control-plane/runs-and-steps.md), [Deploy ownership](../runbooks/deploy-ownership.md)
- **Internal specs:** `external/docs/` for plans, runbooks, and detailed specs.
