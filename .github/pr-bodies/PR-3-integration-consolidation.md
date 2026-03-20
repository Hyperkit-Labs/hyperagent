# Pull Request

---

## Title / Naming convention

**packages, services: consolidate Tenderly, IPFS, shared middleware; remove agent-runtime duplicates**

---

## Context / Description

**What** does this PR change, and **why**?

- Removes duplicate `/simulate`, `/simulate-bundle`, `/deploy`, `/pin`, `/ipfs/pin`, `/ipfs/unpin` from agent-runtime; all traffic goes through simulation, deploy, storage services.
- Wires shared `@hyperagent/backend-middleware` requestIdMiddleware into agent-runtime, simulation, deploy, storage.
- Adds `packages/contract-validation` with `safe_contract_name` and `safe_sol_filename`; compile and audit use it.
- Orchestrator integrations fetch tenderly from simulation, pinata from storage (not agent-runtime).
- Simulation and storage health endpoints return `tenderly_configured` and `pinata_configured`.

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 5: Shared integrations)
- **Related** docs/internal/boundaries.md (agent-runtime, simulation, deploy, storage)

---

## Type of change

- [x] **Refactor** (consolidation, no new behavior)
- [x] **Chore** (shared packages)

---

## How to test

1. Run `pnpm install` at repo root
2. Start simulation, deploy, storage services; verify agent-runtime has only `/agents/*` and `/health`
3. Global search: one Tenderly path (packages/ai-tools), one IPFS path (storage service), one requestIdMiddleware (packages/backend-middleware)

**Special setup / config:** SIMULATION_SERVICE_URL, DEPLOY_SERVICE_URL, STORAGE_SERVICE_URL

---

## Author checklist (before requesting review)

- [x] Code follows the project's style guidelines
- [x] Unit tests (registries, contract-validation)
- [x] Documentation updated
- [x] Changes tested locally
- [x] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Breaking changes:** Agent-runtime no longer exposes simulate/deploy/ipfs; callers must use simulation, deploy, storage services.
- **Technical debt:** Shared Supabase/Redis client factories (packages/backend-clients) planned in follow-up.
