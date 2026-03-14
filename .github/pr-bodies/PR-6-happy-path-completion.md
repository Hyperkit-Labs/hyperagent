# Pull Request

---

## Title / Naming convention

**services, apps/studio: happy-path product completion — Acontext, deploy signing, deployable UI, monitoring agent**

---

## Context / Description

**What** does this PR change, and **why**?

- Wires Acontext into the pipeline so runs can read and write long-term memory/context (audit: adapter exists but not wired).
- Fully wires client-side deploy signing with Thirdweb for multi-chain deploy plans (audit: plans generated but signing not fully wired).
- Replaces ZIP-only UI export with deployable dApp hosting output (audit: generated UI is currently ZIP download, not deployed app).
- Implements the monitoring agent as a real post-deploy subsystem (audit: monitoring listed in pipeline stages but not implemented).

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 6: Happy-path product completion)
- **Related** 0-ORDERED-CHECKLIST.md
- **Related** docs/internal/boundaries.md

---

## Type of change

- [x] **Feature** (Phase 2 product completion)

---

## How to test

1. Run full pipeline; verify Acontext read/write during run
2. Generate deploy plan; sign with Thirdweb; verify deployment completes
3. Generate UI scaffold; verify deployable hosting output (not just ZIP)
4. Complete deploy; verify monitoring agent runs and reports status

**Special setup / config:** ACONTEXT_*, TENDERLY_*, Thirdweb deploy config, hosting provider

---

## Author checklist (before requesting review)

- [ ] Code follows the project's style guidelines
- [ ] Unit tests added or updated
- [ ] Documentation updated
- [ ] Changes tested locally
- [ ] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Scope:** This PR closes the gap between "hardened product" and "entire plan fully met" for the happy path.
- **Acceptance:** No missing Acontext/deploy-hosting/monitoring path per audit strict pass rule.
