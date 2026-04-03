# Subagent handoff rules

Delegation without rules becomes duplication and unsafe mutation. Use these rules when spawning subagents (nested agent runs, delegated tasks, or specialized workers).

## When to spawn subagents

- **Isolation:** The subtask needs a smaller tool allowlist or different model settings.
- **Parallelism:** Independent chunks with merge strategy defined upfront.
- **Expert role:** Distinct persona (audit vs codegen) with separate exit criteria.

Do **not** spawn subagents when a single sequential skill suffices or when handoff cost exceeds work size.

## What subagents inherit

- **Read context:** Parent may pass summarized context, file pointers, and task IDs.
- **Policy:** Subagent runs under **subordinate** policy; cannot exceed parent permissions.
- **Trace linkage:** Subagent records must include **parent run ID** and **handoff version**.

## What subagents must not mutate

- Parent **permission grants** or **identity** (tokens, wallet handles).
- **Global config** outside the delegated scope (CI, org-wide secrets, unrelated services).
- **Shared mutable singletons** without locking semantics; prefer copies and merge protocols.

## How results return

- **Structured result:** Schema includes status, artifacts, errors, and partial outputs.
- **Merge responsibility:** Parent owns merge conflicts and final user-visible summary.
- **Failure propagation:** Subagent failure maps to parent state **failed** with cause chain; no silent drop.

## Timeout and cancellation

- Subagent inherits parent cancellation; subagent **must** honor cancel within bounded time (see [recovery-runbook.md](recovery-runbook.md)).

## Anti-patterns

- “The model will figure out the handoff” without explicit payload schema.
- Subagents that write to the same files without a merge plan.

---

**Index:** [Agent operating model](README.md)
