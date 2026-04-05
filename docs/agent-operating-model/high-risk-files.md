# High-risk file rules

Agentic and automated edits must treat certain paths as **high impact**. Read or explicitly scope before changing them.

## Always read before modifying

| Area | Examples | Why |
|------|------------|-----|
| Auth and session | `apps/api-gateway/src/auth.ts`, `apps/api-gateway/src/authBootstrap.ts`, `apps/studio/proxy.ts`, `apps/studio/lib/authBootstrap.ts`, `apps/studio/lib/session-store.ts` | Breaks login, CSRF/session assumptions, redirects |
| Security and rate limits | `apps/api-gateway/src/rateLimit.ts`, `packages/backend-middleware/src/index.ts` | Abuse surface, accidental lockout |
| BYOK and secrets handling | `apps/api-gateway/src/byok.ts`, studio API clients under `apps/studio/lib/api/` | Key exposure, compliance |
| Env and production rules | `.env.example`, `CLAUDE.md`, `.cursor/rules/production.mdc` | Wrong env splits break prod |
| Database migrations | `supabase/migrations/*.sql` | Irreversible data errors |
| Shared types | `packages/core-types/*` | Cross-service contract breaks |
| Contracts | `contracts/evm/**` | Funds and bytecode risk |

## Do not touch casually

| Area | Examples | Rule |
|------|------------|------|
| Generated lockfiles | `package-lock.json` in packages | Change only with intentional dependency work |
| CI and release gates | `.github/workflows/**`, `release-gate.sh` | Requires CI reasoning |
| License and compliance | `LICENSE`, `SECURITY.md` | Legal review if not trivial |
| External submodules | `external/**` | Treat as upstream; patch via fork or bump |

## Editing discipline

1. **Smallest diff** that satisfies the task; no drive-by refactors in these paths.
2. **Pair code with tests** when behavior changes (gateway auth, middleware, session).
3. **Document migration rollback** in the same PR when touching SQL migrations.

## Escalation

If a task requires edits across auth + migrations + types, split into reviewable commits and list **rollback** steps (see [recovery-runbook.md](recovery-runbook.md)).

---

**Index:** [Agent operating model](README.md)
