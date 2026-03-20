# Pull Request

---

## Title / Naming convention

**services: OpenTelemetry spans, integration tests, health dependency checks**

---

## Context / Description

**What** does this PR change, and **why**?

- Adds OpenTelemetry request spans to orchestrator; OTLP export when `OPENTELEMETRY_ENABLED=1` and `OTEL_EXPORTER_OTLP_ENDPOINT` set.
- Adds integration tests for gateway → orchestrator auth chain: X-User-Id propagation, workflow generate, list scoped by user, get requires owner.
- Simulation and storage health return `tenderly_configured` and `pinata_configured`.
- Orchestrator `otel_spans.py` supports OTLP exporter; `requirements.txt` adds opentelemetry deps.
- Gateway /health fails non-200 when critical dependencies down; service health endpoints dependency-aware.

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 7: Observability/testing)
- **Related** docs/internal/boundaries.md

---

## Type of change

- [x] **Feature** (OTel, tests)
- [x] **Chore** (health semantics)

---

## How to test

1. Set `OPENTELEMETRY_ENABLED=1` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`; run orchestrator; verify spans in Tempo/Jaeger
2. Run `cd services/orchestrator && pytest tests/integration/test_orchestrator_api.py -v`
3. Verify health endpoints return non-200 when critical dependencies fail

**Special setup / config:** OTEL_EXPORTER_OTLP_ENDPOINT, opentelemetry packages

---

## Author checklist (before requesting review)

- [x] Code follows the project's style guidelines
- [x] Unit tests (registries); integration tests (auth chain)
- [x] Documentation updated
- [x] Changes tested locally
- [x] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Technical debt:** OTel for gateway, agent-runtime, compile, audit, simulation, deploy, storage planned in follow-up. This PR covers orchestrator + integration tests + health.
- **Release gate:** Minimum test matrix (unit, integration) runs green; one trace smoke test confirms spans from gateway → orchestrator → downstream.
