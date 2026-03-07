# /branch

Branch protocol for `feature/justinedevs` (trunk-based, PR-driven). See `external/docs/detailed/branch-strategy.md` for full strategy.

## Goals

- Keep `main` protected; feature work does **not** merge directly to `main`.
- Feature branches merge into **`development`**. Releases flow from `development` → `main`.
- Allow you to run a long-lived working branch without a giant, risky merge at the end.

## Branch naming

- Your primary working branch: `feature/justinedevs`
- Optional child branches (recommended for reviewable slices): `feature/justinedevs-phase<1|2|3>-batch<N>`

## Recommended flow (safe long-lived branch)

1. Create `feature/justinedevs` from **`development`** and push it to origin.
2. Open a **rolling PR**: `feature/justinedevs` → **`development`** (not `main`).
3. Work in **batches** (2–5 issues). After each batch:
   - Run checks (lint/test/security where applicable)
   - Update the rolling PR with the new commits
4. Merge cadence:
   - Merge to **`development`** at least once per Phase (preferably more often) to keep divergence low.
   - After merging to `development`, sync `feature/justinedevs` with `development` (rebase or merge; choose one policy and stick to it).

## Production release (before merge to main)

Before the final push to `main`, complete the production transition:

- Clean unnecessary files (debug scripts, temp files, unused assets, `.env` copies)
- Update version and CHANGELOG; tag the release
- Verify full CI, lint, and test suite
- Audit dependencies; remove unused packages; run security scans
- Review secrets and env; ensure no API keys or local paths in committed files
- Open PR from release branch to `main`; require approvals and passing checks

**No merge to `main` without completing this transition.**

## Mandatory pre-action

Before branch operations (create, merge, release):

1. Check `.cursor/rules/` (AGENT.mdc, AGENTS.mdc, maintainer.mdc)
2. Check `.cursor/wiki/` (robots.txt, scope boundaries)
3. Check `.cursor/skills/` (branch-discipline, branch-finalization, pr-workflow)
4. Check `.cursor/llm/` (usage constraints)
5. Then proceed with the operation

See `.cursor/rules/MANDATORY_PRE_ACTION.mdc` for full requirements.

## Review routing (CODEOWNERS)

Reviewers are auto-requested based on touched paths via `CODEOWNERS`:

- `docs/*` → `@JustineDevs @Hyperkit-Labs` (with `docs/planning/*` and `docs/reference/*` owned by `@JustineDevs`)
- `apps/*` → `@Hyperkit-Labs`
- `services/*` → `@JustineDevs`
- `.github/*`, `.cursor/*` → `@JustineDevs @Hyperkit-Labs`

## Merge policy (recommended)

- Prefer **squash merge** for a clean history, unless you need a multi-commit audit trail.
- Require at least 1–2 reviews depending on risk area (contracts/infra/security paths need stricter review).

## Do / Don'ts

**Do:**

- Create feature branches from `development`, not from `main`.
- Run CI checks and pass reviews before merging.
- Use conventional commits (`feat:`, `fix:`, `docs:`, etc.).
- Complete the production transition before merging to `main`.

**Don't:**

- Open PRs from feature branches targeting `main`; feature → **development** only.
- Push directly to `main` or `development`.
- Let `feature/justinedevs` drift for weeks without syncing; large rebases/merges waste time and tokens.
- Merge to `main` without completing the production transition.
