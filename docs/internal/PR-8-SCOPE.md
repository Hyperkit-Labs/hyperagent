# PR-8: Scale architecture closure

**Status:** Scope defined; implementation pending.

## Must be complete to claim full-plan coverage

- [ ] Hardcoded service URLs replaced with service discovery/config abstraction
- [ ] Pipeline execution moved from background threads to queue/job model
- [ ] Worker processes for long-running steps; job state in run_state
- [ ] Redis queue/cache/limiter separation via shared clients and explicit roles

## Implementation notes

- **Service discovery:** Environment-driven URLs or shared registry; remove localhost defaults
- **Queue/job:** Message queue between gateway and orchestrator; jobs instead of threads
- **Workers:** Long-running steps in worker processes; persist transitions to run_state
- **Redis:** Shared `packages/backend-clients`; separate queue, cache, limiter concerns

## References

- 0-ORDERED-CHECKLIST.md
- Full-completion implementation outline (Workstream 8)
