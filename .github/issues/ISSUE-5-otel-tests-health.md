# [5/8] OpenTelemetry, health, and tests

## 🎯 Layer 1: Intent Parsing

**Task Title:** services: OpenTelemetry spans, integration tests, health dependency checks

**Primary Goal:** Distributed tracing across gateway, orchestrator, agent-runtime, compile, audit, simulation, deploy, storage. Dependency-aware health. Minimum test matrix green.

**User Story / Context:** As an operator, I want traces and meaningful health checks so that I can debug and detect outages.

**Business Impact:** Observability; no "zero tests" risk per audit.

**Task Metadata:**
- **Sprint**: Sprint 3
- **Milestone**: Phase 1 – Sprint 3 (Mar 3–16)
- **Related Epic/Project**: GitHub Project 9
- **Issue Type**: Feature
- **Area**: observability
- **Chain**: N/A
- **Preset**: N/A
- **Labels**: area:observability, type:feature

**Project Board (Required):** GitHub Project 9

---

## 📚 Layer 2: Knowledge Retrieval

**Required Skills / Knowledge:**
- [ ] OpenTelemetry, pytest, Playwright

**Estimated Effort:** L (1+ weeks)

**Code Examples & Patterns:**

Current: no OTel; shallow health:

```python
# services/orchestrator/main.py - health returns {"status":"ok"} even when deps down
@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", ...}  # Does not check Supabase, Redis, etc.
```

Target OTel span pattern:

```python
# services/orchestrator/otel_spans.py
from opentelemetry import trace
def span(name: str, **attrs):
    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span(name, attributes=attrs) as s:
        yield s
```

Target health (dependency-aware):

```python
@app.get("/health")
def health() -> dict[str, Any]:
    supabase_ok = _check_supabase()
    redis_ok = _check_redis()
    if not supabase_ok or not redis_ok:
        raise HTTPException(status_code=503, detail="Critical dependency down")
    return {"status": "ok", "supabase": supabase_ok, "redis": redis_ok}
```

---

## ⚠️ Layer 3: Constraint Analysis

**Known Dependencies:** [4/8] recommended

**Technical Constraints:** OTLP export; health non-200 on critical dependency failure

---

## 💡 Layer 4: Solution Generation

**Solution Approach:**
- OTel spans: gateway, orchestrator, agent-runtime, compile, audit, simulation, deploy, storage
- Spans for HTTP, Supabase, Redis, Tenderly, IPFS
- Health: dependency-aware; non-200 when critical deps down
- Unit tests: security/evaluator, llm_keys_encryption, store, registries
- Integration tests: gateway→orchestrator auth chain
- Playwright E2E: connect wallet → workflow result

**Acceptance Criteria:**
- [ ] One trace visible gateway → orchestrator → downstream
- [ ] Health non-200 on broken dependencies
- [ ] Minimum test matrix green in CI

---

## 📋 Layer 5: Execution Planning

**Implementation Steps:**
1. [ ] Add OTel to all core services
2. [ ] OTLP export; metrics
3. [ ] Upgrade health endpoints
4. [ ] Unit + integration + Playwright E2E

**Required Env:** OPENTELEMETRY_ENABLED, OTEL_EXPORTER_OTLP_ENDPOINT

---

## ✅ Layer 6: Output Formatting & Validation

**Ownership & Collaboration:** **Owner**: @JustineDevs | **Reviewer**: TBD | **Deadline**: TBD

**Delivery Status:** To Do. Implement in `feature/justinedevs` before PR to `development`.
