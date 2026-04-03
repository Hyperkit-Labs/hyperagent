# Agent operating model (HyperAgent)

This folder is the canonical place for **taxonomy, boundaries, and governance** for commands, skills, agents, tasks, plugins, permissions, memory, verification, and recovery.

## Start here

Read the **[architecture map](architecture-map.md)** first, then use the **[glossary](glossary.md)** for shared vocabulary.

---

## Full index (all documents)

| Document | Purpose |
|----------|---------|
| [agents.md](agents.md) | Agent roles, responsibilities, validation, and boundaries |
| [architecture-map.md](architecture-map.md) | Repository map: commands, skills, agents, tasks, plugins, permissions, memory, control plane |
| [bridge.md](bridge.md) | Bridge and control plane: remote sessions, heartbeats, transport vs execution policy |
| [commands.md](commands.md) | Command entrypoints, registry pattern, and boundaries |
| [glossary.md](glossary.md) | Definitions with “use when / do not use when” |
| [high-risk-files.md](high-risk-files.md) | Paths and folders that require explicit review before edit |
| [permission-approval-policy.md](permission-approval-policy.md) | When to prompt, auto-approve, deny, or escalate |
| [plugin-trust-validation.md](plugin-trust-validation.md) | Trust tiers, install scopes, validation, load failure, rollback |
| [recovery-runbook.md](recovery-runbook.md) | Timeouts, reconnect, stale state, retry budget, stop conditions |
| [skill-operating-guide.md](skill-operating-guide.md) | Skill naming, authoring, validation, discovery, permissions |
| [state-boundaries.md](state-boundaries.md) | State domains, ownership, and mutation rules |
| [subagent-handoff-rules.md](subagent-handoff-rules.md) | Delegation, inheritance, mutation limits, result return |
| [task-lifecycle-spec.md](task-lifecycle-spec.md) | Task types, states, cancellation, cleanup |
| [verification-methodology.md](verification-methodology.md) | Verifier types, acceptance criteria, rerun rules, failure taxonomy |

---

## Suggested reading order (priority 1–10)

| Order | Document |
|-------|----------|
| 1 | [architecture-map.md](architecture-map.md) |
| 2 | [glossary.md](glossary.md) |
| 3 | [high-risk-files.md](high-risk-files.md) |
| 4 | [skill-operating-guide.md](skill-operating-guide.md) |
| 5 | [permission-approval-policy.md](permission-approval-policy.md) |
| 6 | [verification-methodology.md](verification-methodology.md) |
| 7 | [task-lifecycle-spec.md](task-lifecycle-spec.md) |
| 8 | [plugin-trust-validation.md](plugin-trust-validation.md) |
| 9 | [subagent-handoff-rules.md](subagent-handoff-rules.md) |
| 10 | [recovery-runbook.md](recovery-runbook.md) |

**Concept docs** to read alongside the map: [agents.md](agents.md), [commands.md](commands.md), [bridge.md](bridge.md), [state-boundaries.md](state-boundaries.md).

---

## Related project docs

- [Contributor guide](../developer-guide.md) — local setup and repository navigation
- [CLAUDE.md](../../CLAUDE.md) — project constitution and stack
- `.cursor/rules/AGENT.mdc` — agent configuration and skill index pointers
