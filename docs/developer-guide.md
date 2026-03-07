# Developer guide

Setup and workflow for anyone developing or contributing to HyperAgent.

---

## Repo structure

The repo is a monorepo (pnpm workspaces). Main areas:

| Path | Purpose |
|------|--------|
| `apps/studio` | Next.js frontend (HyperAgent Studio). Primary app for users. |
| `apps/api-gateway` | API gateway (auth, routing, x402). Stub. |
| `apps/docs` | Documentation site. Stub. |
| `services/*` | Backend services (orchestrator, codegen, audit, simulation, deploy, etc.). Stubs. |
| `packages/*` | Shared packages (sdk-ts, config, ui, core-types, web3-utils, ai-tools). Some have minimal stubs for Studio. |
| `contracts/evm`, `contracts/templates` | Smart contracts and blueprints. Stubs. |
| `infra/docker`, `infra/k8s`, `infra/terraform` | Infrastructure. Stubs. |
| `platform/supabase`, `platform/redis` | Supabase and Redis config. Stubs. |
| `docs/` | Documentation (onboarding, user guide, developer guide). |

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
   - Copy `.env.example` to `.env` at repo root if present.
   - For Studio: set `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`, `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8000`).

3. **Run Studio**
   ```bash
   pnpm --filter hyperagent-studio dev
   ```
   Or:
   ```bash
   cd apps/studio && pnpm dev
   ```
   App: [http://localhost:3000](http://localhost:3000).

4. **Backend**
   - If the project provides a backend (e.g. Python API + Docker), follow its run instructions so the API is available at the URL used by `NEXT_PUBLIC_API_URL`.
   - Studio calls that API for workflows and data.

---

## Commands (monorepo)

From repo root:

```bash
pnpm install              # Install all workspace deps
pnpm --filter hyperagent-studio dev    # Run Studio dev server
pnpm --filter hyperagent-studio build  # Build Studio
pnpm turbo lint           # Lint (if turbo.json exists)
pnpm turbo test           # Test (if turbo.json exists)
```

---

## Contributing

1. Fork the repo and create a branch (`feature/...` or `fix/...`).
2. Make changes. Follow existing code style and run lint/tests.
3. Commit with clear messages (e.g. `feat: ...`, `fix: ...`).
4. Push and open a Pull Request. Fill in the PR template if present.
5. Address review feedback. Merge when approved and checks pass.

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the repo root for full guidelines.

---

## Where to look

- **Onboarding:** [Getting started](getting-started.md)  
- **End-user usage:** [User guide](user-guide.md)  
- **Architecture / internal specs:** See `docs/specs`, `docs/adr`, `docs/runbooks` and repo README when you need deeper context.
