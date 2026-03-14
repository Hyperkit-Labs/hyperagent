# Pull Request

---

## Title / Naming convention

**services, infra: scale architecture closure — service discovery, queue/job model, worker processes**

---

## Context / Description

**What** does this PR change, and **why**?

- Replaces localhost-style hardcoded service URLs with environment-driven service discovery or shared service registry/config layer (audit: hardcoded URLs hurt at scale).
- Moves pipeline execution from background-thread execution to a queue/job architecture (audit: no message queue between gateway and orchestrator; runs are background threads).
- Adds worker processes for long-running pipeline steps; persists job state transitions into `run_state` (audit: current execution model is scale-fragile).
- Keeps Redis-backed checkpointing and rate limiting; separates queue, cache, and limiter concerns through shared clients and explicit service roles (audit: Redis usage split and non-shared).

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 8: Scale architecture closure)
- **Related** 0-ORDERED-CHECKLIST.md
- **Related** docs/internal/boundaries.md

---

## Type of change

- [x] **Feature** (scale architecture)
- [x] **Refactor** (execution model)

---

## How to test

1. Configure service discovery; verify no hardcoded localhost URLs in runtime
2. Start pipeline; verify job enqueued and worker processes run steps
3. Verify run_state persists job transitions
4. Verify Redis queue/cache/limiter separation

**Special setup / config:** Service registry, Redis queue, worker processes, REDIS_URL

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

- **Scope:** No background-thread-only pipeline architecture for scale per audit strict pass rule.
- **Acceptance:** Full plan complete when all eight PRs merged and runtime-verified.
