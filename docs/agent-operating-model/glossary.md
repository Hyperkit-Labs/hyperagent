# Glossary

Short definitions with **use when** and **do not use when** so “agent”, “skill”, “task”, and “command” stay precise.

## Command

**Definition:** A named entrypoint with a stable contract (inputs, effects, and where it runs).

**Use when:** You expose a user or operator action (slash command, menu action, CLI verb, or HTTP route intended as a product entry).

**Do not use when:** You mean a reusable multi-step procedure without a single entry (see **Skill**) or a long-running tracked unit (see **Task**).

## Skill

**Definition:** A reusable procedure package: instructions, allowed tools, discovery metadata, and optional UI exposure.

**Use when:** The same workflow repeats (review, onboarding, test synthesis, incident triage) and should stay composable.

**Do not use when:** You only need a one-off prompt in a single component, or you are naming a product feature that is really a **Task** or **Agent** role.

## Agent

**Definition:** A reasoning or execution persona with bounded responsibility (spec, codegen, audit, deploy, monitor).

**Use when:** You refer to pipeline stages, the runtime host that runs tools, or orchestration nodes with a defined role.

**Do not use when:** You mean the whole application, or a single HTTP handler, or any background job without persona boundaries.

## Task

**Definition:** A tracked unit of work with explicit state, terminal outcome, and cleanup semantics.

**Use when:** Work is async, delegated, retried, or must show up in a queue or run history.

**Do not use when:** The work is purely synchronous UI validation with no durable record.

## Plugin

**Definition:** An extension package loaded under explicit trust rules; may register commands, skills, or integrations.

**Use when:** Third-party or optional capability ships as an add-on with its own manifest and validation.

**Do not use when:** You mean a normal internal module; call it a library or package instead.

## Permission (policy)

**Definition:** Explicit allow / ask / deny (and escalation) for tools, files, network, and shell-like actions.

**Use when:** Modeling safety, approvals, or automated background behavior.

**Do not use when:** You only describe UX copy; bind policy to enforceable rules and audit points.

## Memory

**Definition:** Layered context: transient turn state, session state, durable project memory, task memory, and agent-local memory.

**Use when:** Discussing what persists across turns, what can be compacted, and what must never leak.

**Do not use when:** You mean generic “context window” without persistence or ownership.

## Control plane

**Definition:** Orchestration of sessions, workers, heartbeats, reconnect, token refresh, and shutdown—separate from executing domain work.

**Use when:** Describing spawn/teardown, queue routing, retries, and cross-service coordination.

**Do not use when:** You mean a single model inference or a single tool call (that is execution-plane work).

## Execution plane

**Definition:** The locus that performs work: tool runs, simulations, deploy steps, storage writes.

**Use when:** Separating **policy and routing** from **doing the job**.

**Do not use when:** You are only naming the UI shell.

## Verification

**Definition:** Structured confirmation of behavior (API, UI, CLI, workflow) with pass/fail and rerun rules—distinct from unit tests and from human review.

**Use when:** You need repeatable confidence after a change or agent output.

**Do not use when:** You only ran `npm test` and conflated that with product acceptance.

---

**Index:** [Agent operating model](README.md)
