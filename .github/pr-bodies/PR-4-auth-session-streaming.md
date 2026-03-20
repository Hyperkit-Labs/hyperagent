# Pull Request

---

## Title / Naming convention

**apps/studio: SessionProvider, bootstrap failure fatal, SSE-first workflow updates**

---

## Context / Description

**What** does this PR change, and **why**?

- Makes SessionProvider the single source of truth for session state across protected pages.
- Makes `useAutoBootstrap` treat bootstrap failure as fatal: blocking error, redirect to /login, no ghost state.
- Upgrades middleware from cookie-only gating to session-expiry-aware validation.
- Makes SSE the primary workflow-progress path; keeps polling only as fallback when stream fails or goes stale.
- Splits `apps/studio/lib/api.ts` by domain (core, workflows, billing, settings, deployments).
- Removes fake arrays, fake histories, zero-value placeholders; labels unfinished surfaces explicitly.

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 3: Auth/session correctness, Workstream 6: Frontend/runtime UX)
- **Related** docs/internal/boundaries.md

---

## Type of change

- [x] **Feature** (session authority, SSE-first)
- [x] **Bug fix** (ghost state, bootstrap failure)
- [x] **Refactor** (api.ts split)

---

## How to test

1. Open /payments or another protected route without session; confirm redirect
2. Force bootstrap failure; confirm UI never lands in "connected wallet but no session" state
3. Start a workflow; confirm progress is primarily stream-driven, polling only when stream disconnected

**Special setup / config:** AUTH_JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY

---

## Author checklist (before requesting review)

- [x] Code follows the project's style guidelines
- [ ] Unit tests added or updated
- [x] Documentation updated
- [x] Changes tested locally
- [x] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Technical debt:** Full api.ts domain split (core, workflows, billing, settings, deployments) may be incremental.
