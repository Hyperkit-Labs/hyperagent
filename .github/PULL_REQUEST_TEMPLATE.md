# Pull Request

---

## Title / Naming convention

Use a **clear, concise title** in the format enforced by CI:

- **Required format**: `directory or scope: short description`
- **Examples**: `services/orchestrator: add provider resolver`, `docs/planning: update master index`, `apps/hyperagent-web, libs/sdk-ts: fix login flow`
- **Avoid**: Titles that look like generic Conventional Commits only (for example `feat: add feature`). Use the directory-prefix format so reviewers and CI can validate scope.

---

## Context / Description

**What** does this PR change, and **why**?

- High-level overview of the problem solved or the feature added.
- Brief design or approach (link to ADR or issue if needed).

---

## Related issues / tickets

Link to relevant GitHub issues or external tickets so reviewers have full context.

- **Closes**
- **Related**

---

## Type of change

Classify this PR (check one or more as applicable):

- [ ] **Feature** (Phase 1 / 2 / 3 — align with issue phase labels)
- [ ] **Bug fix**
- [ ] **Documentation** (docs, README, ADRs)
- [ ] **Chore** (infra, tooling, config)
- [ ] **Refactor** (no new behavior)
- [ ] **Other**

---

## How to test

Steps for reviewers (or CI) to verify the changes:

1.
2.
3.

**Special setup / config:**

---

## Screenshots / demos

For **UI or behavior changes**, add screenshots or a short GIF to illustrate.

---

## Author checklist (before requesting review)

- [ ] Code follows the project's style guidelines (see `.cursor/rules/rules.mdc`)
- [ ] Unit tests added or updated and coverage is acceptable (target 80%+ where applicable)
- [ ] Documentation (code comments, README, ADRs) updated as needed
- [ ] Changes tested locally (and steps captured in "How to test" above)
- [ ] No secrets or `.env` in the diff
- [ ] CODEOWNERS review expected for touched paths
- [ ] CI passes (including PR title/format and any template checks)

---

## Additional notes

Optional but helpful for reviewers:

- **Performance**: Any impact or benchmarks?
- **Technical debt**: Follow-ups or known limitations?
- **Breaking changes**: If any, describe and how to migrate.
- **Other**: Dependencies, rollout notes, etc.