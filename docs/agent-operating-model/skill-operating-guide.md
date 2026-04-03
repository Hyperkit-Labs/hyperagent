# Skill operating guide

Skills are **first-class reusable procedures** (prompts + allowed tools + metadata). This guide standardizes how they are named, authored, validated, discovered, and permissioned.

## Naming rules

- Use **kebab-case** or **lower_snake** consistently with existing `.cursor/skills/` entries; do not mix styles inside one skill folder.
- Name reflects **outcome**, not implementation: `backend-testing` not `jest-stuff`.
- One primary **SKILL.md** per skill directory; auxiliary files live beside it with clear names (`references/`, `examples/`).

## Authoring rules

1. **Purpose** — One paragraph: when to invoke, expected inputs, and forbidden uses.
2. **Triggers** — Bullet list of user phrases or task types that should route here.
3. **Steps** — Ordered procedure the agent follows (not vague prose).
4. **Tools boundary** — Explicit list of tools/files the skill may assume; call out **read-only** vs **write** paths.
5. **Exit criteria** — What “done” means and what artifact to leave (file, PR comment, test list).
6. **Failure modes** — What to do on missing credentials, flaky network, or partial data.

## Validation rules

- **Dry run:** Skill text must not reference binaries or paths that do not exist in this repo without stating how to obtain them.
- **Scope check:** No instruction that contradicts `CLAUDE.md` or `.cursor/rules/production.mdc` (e.g., server-side user LLM keys).
- **Safety check:** File deletion, `git push --force`, and production DB writes require explicit human gate language in the skill.

## Discovery rules

- Register skills in `docs/planning/INSTALLED_SKILLS.md` when the skill is meant for broad agent use.
- `.cursor/rules/AGENT.mdc` may point to categories; keep pointers **stable** (avoid renaming without redirect notes).

## Permission rules

- Skills run under the **same permission context** as the invoking agent; they do not grant extra rights.
- If a skill needs elevated access, it must instruct **ask / deny** behavior per [permission-approval-policy.md](permission-approval-policy.md), not bypass policy.

## Anti-patterns

- A skill that is only a long prompt dump with no triggers or boundaries.
- Duplicating a command’s responsibilities (see [glossary.md](glossary.md): command vs skill).

---

**Index:** [Agent operating model](README.md)
