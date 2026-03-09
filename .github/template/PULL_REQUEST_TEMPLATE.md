# Pull Request

---

## Title / Naming convention

Use a **clear, concise title** in the format enforced by CI:

- **Required format**: `directory or scope: short description`
- **Examples**: `services/orchestrator: add provider resolver`, `docs/planning: update master index`, `apps/hyperagent-web, libs/sdk-ts: fix login flow`
- **Avoid**: Titles that look like generic Conventional Commits only (e.g. `feat: add feature`) — use the directory-prefix format above so reviewers and CI can validate scope.

---

## Context / Description

**What** does this PR change, and **why**?

- High-level overview of the problem solved or the feature added.
- Brief design or approach (link to ADR or issue if needed).

<!-- Describe the "why" and "what" of the changes -->

---

## Related issues / tickets

Link to relevant GitHub issues or external tickets so reviewers have full context.

- **Closes** <!-- e.g. Closes #123 -->
- **Related** <!-- e.g. Related to #456, JIRA-789 -->

---

## Type of change

Classify this PR (check one or more as applicable):

- [ ] **Feature** (Phase 1 / 2 / 3 — align with issue phase labels)
- [ ] **Bug fix**
- [ ] **Documentation** (docs, README, ADRs)
- [ ] **Chore** (infra, tooling, config)
- [ ] **Refactor** (no new behavior)
- [ ] **Other** <!-- describe -->

---

## How to test

Steps for reviewers (or CI) to verify the changes:

1. <!-- Step 1: e.g. Check out branch, install deps -->
2. <!-- Step 2: e.g. Run `cd services/orchestrator && pytest -v` -->
3. <!-- Step 3: any special setup or env vars -->
4. <!-- Optional: link to issue's "Implementation Steps" or "Environment Setup" -->

**Special setup / config:**  
<!-- Any non-default env, flags, or services required -->

---

## Screenshots / demos

For **UI or behavior changes**, add screenshots or a short GIF to illustrate.

<!-- Optional: paste images or link to a short demo -->

---

## Author checklist (before requesting review)

Verify these before requesting review (aligned with [ISSUE_TEMPLATE.md](.github/template/ISSUE_TEMPLATE.md) Layer 6 quality gates):

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

