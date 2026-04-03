# Permission and approval policy

This policy defines **when to prompt**, **when to auto-approve**, **when to deny**, and **when to escalate** for tool execution, file writes, network calls, and shell commands. It applies to autonomous agents, IDE agents, and background workers unless a narrower runbook overrides it.

## Policy axes

| Axis | Examples | Default stance |
|------|-----------|----------------|
| **Data sensitivity** | Secrets, keys, PII, wallet material | Ask or deny |
| **Irreversibility** | `rm -rf`, production DB migration, main branch force-push | Deny without human |
| **Blast radius** | Monorepo-wide refactor, shared types, auth middleware | Ask |
| **Cost / abuse** | Paid API bursts, large outbound traffic | Ask or throttle |

## When to prompt (ask)

- First-time **write** to a protected path (see [high-risk-files.md](high-risk-files.md)).
- Any operation that **changes identity**: credentials, OAuth scopes, wallet connect flows.
- Commands that **expand scope** beyond the user’s stated task (new service, new deployment target).

## When to auto-approve

- **Read-only** inspection: file read, directory list, grep, build log read.
- **Idempotent local dev** actions explicitly requested: `npm test` in sandbox, lint on branch.
- **Already-granted session capabilities** where the gateway has issued a token scoped to that action (no broader scope).

Background agents with **no interactive channel** must default to **deny or narrow** rather than prompt.

## When to deny

- Mixing **transport** with **policy** (e.g., disabling TLS verification to “fix” connectivity).
- Bypassing **BYOK** rules: never inject user LLM keys into server env.
- Implicit **privilege elevation** (sudo, admin tokens) without runbook.

## When to escalate to a human

- Security incident signals: leaked keys in logs, accidental public paste, suspicious outbound domains.
- **Irreversible** data operations without backup or migration rollback plan.
- Conflicting instructions between user message and org policy: stop and escalate.

## Approval flow properties

- Approvals must be **attributable** (who approved, what scope, what time window).
- Re-approval is required when **scope changes** (new repo, new cloud, new chain).

## Plan mode and elevated mode

- **Plan mode:** Read and propose only; no writes or external side effects.
- **Elevated mode:** Pre-declared list of paths and commands; anything outside list requires new approval.

See also: [verification-methodology.md](verification-methodology.md) for post-change checks.

---

**Index:** [Agent operating model](README.md)
