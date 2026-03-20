# [8/8] Scale architecture closure

## 🎯 Layer 1: Intent Parsing

**Task Title:** services, infra: scale architecture closure — service discovery, queue/job model, worker processes

**Primary Goal:** Replace hardcoded URLs with service discovery; move pipeline from background threads to queue/job model; worker processes; Redis queue/cache/limiter separation.

**User Story / Context:** As an operator, I want a scalable execution model so that the system can handle many concurrent runs without fragility.

**Business Impact:** Required for scale; removes audit-flagged background-thread fragility.

**Task Metadata:**
- **Sprint**: Sprint 3
- **Milestone**: Phase 1 – Sprint 3 (Mar 3–16)
- **Related Epic/Project**: GitHub Project 9
- **Issue Type**: Feature
- **Area**: infra
- **Chain**: N/A
- **Preset**: N/A
- **Labels**: area:infra, type:feature

**Project Board (Required):** GitHub Project 9

---

## 📚 Layer 2: Knowledge Retrieval

**Required Skills / Knowledge:**
- [ ] Service discovery, message queues, Redis, worker patterns

**Estimated Effort:** L (1+ weeks)

**Code Examples & Patterns:**

Current hardcoded URLs:

```python
# services/orchestrator/main.py
AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001")
SIMULATION_SERVICE_URL = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002")
# No service discovery; localhost defaults hurt at scale
```

Current background-thread execution:

```python
# Pipeline runs as background task; no queue
# gateway -> orchestrator -> BackgroundTasks.add_task(run_pipeline)
# No job persistence; no worker processes
```

Target: service discovery + queue:

```python
# packages/backend-clients or infra config
def get_service_url(service: str) -> str:
    # Env-driven or registry lookup; no localhost default in prod
    ...

# Queue between gateway and orchestrator
# Job enqueued; worker picks up; run_state persists transitions
```

---

## ⚠️ Layer 3: Constraint Analysis

**Known Dependencies:** [7/8] recommended

**Technical Constraints:** Redis checkpointing and rate limiting must remain; separate queue/cache/limiter concerns

---

## 💡 Layer 4: Solution Generation

**Solution Approach:**
- Service discovery: env-driven URLs or shared registry; no localhost defaults
- Queue/job: message queue gateway↔orchestrator; jobs instead of threads
- Workers: long-running steps in worker processes; persist to run_state
- Redis: shared backend-clients; explicit queue/cache/limiter roles

**Acceptance Criteria:**
- [ ] No hardcoded localhost URLs in runtime
- [ ] Pipeline runs as jobs; workers process steps
- [ ] run_state persists job transitions
- [ ] Redis concerns separated

---

## 📋 Layer 5: Execution Planning

**Implementation Steps:**
1. [ ] Implement service discovery/config layer
2. [ ] Add queue between gateway and orchestrator
3. [ ] Worker processes for pipeline steps
4. [ ] Redis separation (queue, cache, limiter)

**Required Env:** Service registry, Redis queue, REDIS_URL

---

## ✅ Layer 6: Output Formatting & Validation

**Ownership & Collaboration:** **Owner**: @JustineDevs | **Reviewer**: TBD | **Deadline**: TBD

**Delivery Status:** To Do. Implement in `feature/justinedevs` before PR to `development`. Full plan complete when all 8 issues implemented and runtime-verified.
