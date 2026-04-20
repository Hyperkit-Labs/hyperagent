# HyperAgent production readiness assessment (repo-verified)

This document replaces earlier draft claims with statements checked against the current tree. Line references point to files as they exist now.

## Executive summary

The platform has a substantial orchestration pipeline (LangGraph, SCRUBD, audits, simulation gates, mainnet guard). Several **critical claims in the old assessment were inaccurate**: Kubernetes orchestrator manifests are **non-root with resource limits**, SCRUBD is **commit-pinned** in Dockerfiles, and **NetworkPolicy** resources exist under `infra/k8s/base/`. Remaining risks are **real but narrower** than described: x402 replay protection **requires Redis** when x402 is on (with an escape hatch and a Redis-failure fallback path), credits **use an atomic RPC** in production with **non-atomic fallback blocked** in prod-shaped environments, and observability depends on **correct OTLP env**, not hardcoded localhost in code.

---

## 1. x402 payment and replay protection

### Verified behavior (`services/orchestrator/x402_middleware.py`)

- **In-memory nonce dict** `_nonce_cache` still exists (around lines 98–99) as a **fallback** when Redis is not used or when Redis operations fail in non-mandatory-Redis modes.
- When x402 is enabled and **`X402_ALLOW_INMEMORY_NONCE` is not set**, **`ensure_x402_redis_for_startup()`** requires **`REDIS_URL` or `UPSTASH_REDIS_URL`** (TCP Redis) so multi-worker deployments do not rely on process memory alone.
- **`_check_replay`** (from ~260) uses **Redis `SET` with `NX` and TTL** when the Redis client is available; if **`_replay_requires_redis_backend()`** is true and Redis is missing, it **raises** instead of silently using memory.
- **Residual risk:** If x402 is configured so Redis is not mandatory, or Redis errors are caught and the code **falls back to in-memory** (~292–309), replay safety across workers can degrade. Production-shaped envs then log an **error** (~297–302) about in-memory nonce cache—not only `NODE_ENV`; **`_is_production_env()`** also considers `RENDER` and `ENVIRONMENT`.
- **Facilitator:** Previously, facilitator HTTP errors could **admit the request** without settlement. **Mitigation (implemented):** production-shaped environments now **fail closed** by default (`_call_facilitator` returns unsettled). Set **`X402_FACILITATOR_FAIL_OPEN=1`** only for incident/lab; non-production defaults remain open for local dev.
- **Redis → memory:** If Redis `SET` fails after the mandatory-Redis path, **production + x402 on** now **raises** instead of silently falling back to in-memory nonces.

**Conclusion:** The old claim “local memory only allows replay across workers in production” is **overbroad** for the default **x402 + Redis required** path, but **still relevant** for misconfiguration or escape hatches. Facilitator and Redis-error paths are **tightened** as above.

---

## 2. Credits / top-up (`services/orchestrator/credits_supabase.py`)

- **`top_up`** (~109) documents **atomic RPC** (`top_up_credits`) to avoid races and **retries up to 3 times** on transient failures (~125–164)—not “only database atomicity” in a vague sense.
- **`_top_up_fallback`** (~167+) is **non-atomic** and is **blocked in production-shaped environments** via **`_is_production_blocking()`** (~177), reducing double-credit risk when the RPC is missing.

**Conclusion:** Race/double-spend via fallback is **mitigated by blocking fallback in prod**; the RPC path is the intended production mechanism.

---

## 3. Supply chain: SCRUBD

### Docker (`infra/docker/Dockerfile.orchestrator`)

- The image **does not** use `git clone --depth 1 --branch V6.0` as claimed in the old text. It uses **`git fetch --depth 1 origin ${SCRUBD_GIT_SHA}`** with default **`SCRUBD_GIT_SHA=9dba1928d4aea9a5d27014e5f31a8ed0b703f711`** (~8–13).
- Runtime/agent code: **`services/orchestrator/agents/scrubd_agent.py`** uses **`SCRUBD_PATH`**, **`SCRUBD_GIT_COMMIT`**, and the same repo URL—there is **no** `SCRUBD_BASE_PATH` / `from scrubd_agent import SCRUBD_BASE_PATH` as in the old claim.
- **Residual risk:** Trust is still placed in the **sujeetc/SCRUBD** GitHub repo at a **pin**; pins should be **reviewed and bumped deliberately** (supply chain and license posture).

### Container user

- Dockerfile uses **`USER appuser`** with **UID 10001** (~14–16), not `1001`.

---

## 4. Kubernetes (`infra/k8s/base/orchestrator-deployment.yaml`)

### Pod security

- **Pod-level** `securityContext`: **`runAsNonRoot: true`**, **`runAsUser: 10001`**, **`runAsGroup: 10001`**, **`fsGroup: 10001`** (~19–23)—not root.
- **Container-level**: **`allowPrivilegeEscalation: false`**, **`readOnlyRootFilesystem: true`**, **`capabilities.drop: ["ALL"]`** (~27–31).

### Resources

- **Requests:** 512Mi / 300m; **limits:** 1Gi / 1500m (~48–54)—not “no limits.”

### Network policy

- **`infra/k8s/base/network-policies.yaml`** defines **NetworkPolicy** resources (e.g. default-deny style with explicit egress/ingress). The old claim that the entire `infra/k8s/base/` lacks network policies is **false**.

**Conclusion:** The old bullets about orchestrator running as root, no limits, and no NetworkPolicies **do not match** this repository’s base manifests.

---

## 5. Authentication and public API paths

- **Agent session JWT** (`services/orchestrator/agent_session_jwt.py`): **`JWT_SECRET_KEY`** is required when creating/verifying agent session tokens (~60–62, ~79+)—accurate concern for ops if unset.
- **Studio `core.ts`:** Public-path handling for **quieter logging** uses **`isOptionalPublicApiPathForLogging`** from **`@hyperagent/api-contracts`** in **`reportApiError`** (~175–194). That is **not** an authentication bypass on the gateway; gateway auth remains **`apps/api-gateway/src/auth.ts`** and public path lists in **`api-contracts`**.

---

## 6. Observability

- **Prometheus:** **`services/orchestrator/observability.py`** defines **`hyperagent_request_latency_seconds`** and related metrics (~52–56)—aligned with the old positive note; multiproc dir handling is guarded (~29–46).
- **OpenTelemetry:** Exporter failures are typically **environment/connectivity** (collector URL, firewall). **`services/orchestrator/otel_spans.py`** resolves the OTLP HTTP endpoint from **`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` / `OTEL_EXPORTER_OTLP_ENDPOINT`**; it does **not** hardcode `http://127.0.0.1:4318` inside that module. Example defaults appear in **`.env.example`**, not as a forced constant in code.

---

## 7. Pipeline and security gates

### LangGraph workflow (`services/orchestrator/workflow.py`)

- The graph includes **spec**, **design**, **codegen**, **security_gate**, **test_generation**, **scrubd_validation**, **audit**, **guardian**, **deploy**, **simulation**, **security_policy_evaluator**, **exploit_simulation**, **ui_scaffold**, etc. (~115–200+). The old snippet showing only `spec`/`design` is **incomplete**.

### Mainnet guard (`services/orchestrator/mainnet_guard.py`)

- **`check_mainnet_guard`** requires **`simulation_passed`**, successful simulation for the chain where applicable, and **blocks** on **high/critical audit findings** (~24–53). Wording like `if not simulation_passed` is **directionally right** but should cite this file’s actual field names and messages.

### `security_patterns.py`

- **`services/orchestrator/security_patterns.py`** performs **regex-based static scans** for secrets in contract source (`scan_contracts`)—it does **not** contain **`audit_findings = await run_security_audits`**. Full audit integration lives in **agents** and **`services/orchestrator/security/`** (evaluator, normalizers, etc.).

---

## 8. MVP v0.1.0 readiness (concise)

| Area | Status |
|------|--------|
| x402 replay | **Stronger than “memory only”** if Redis + startup checks enabled; **review** escape hatches and facilitator behavior. |
| Credits | **Atomic RPC** in prod; **fallback blocked** in prod-shaped env. |
| SCRUBD supply chain | **Commit-pinned** in Docker; still **third-party repo trust**. |
| K8s base orchestrator | **Non-root**, **limits**, **read-only root FS**, **NetworkPolicy** present in repo. |
| Observability | Metrics in code; traces depend on **deployment env**. |
| Pipeline | **Rich** graph with SCRUBD, simulation, policy evaluator, mainnet guard—not a minimal two-node demo. |

Treat this file as **documentation of current code**, not a certification. Formal readiness still requires **your** SLOs, threat model, and deployment parity with these manifests.

---

## Appendix: Review of a “10/10 readiness” execution plan

External plans should be reconciled with this tree before implementation. Below: common proposals vs **current code**.

### P0 — Critical fixes

**1. “Make x402 mandatory by default” (snippet using only `NODE_ENV`)**  
**Already partially true:** `_effective_x402_enabled_env()` defaults **`X402_ENABLED` to `"1"`** when **`_is_production_env()`** is true, which includes **`RENDER`**, **`NODE_ENV=production`**, and **`ENVIRONMENT=production`** (`x402_middleware.py`). **`X402_MANDATORY_V01`** still forces enforcement regardless of env.  
**Do not** replace this with `NODE_ENV == "production"` only; you would **drop RENDER/ENVIRONMENT parity** with the rest of the orchestrator. To tighten further: set **`X402_MANDATORY_V01=1`** and **`X402_ENABLED=1`** in deployment config, and keep **Redis** required for replay (see §1 of the main doc). A second `policy_evaluator.py` duplicate is unnecessary.

**2. “Remove credits-first UI; `CREDITS_ENABLED=0`”**  
This is a **product and metering decision**, not a security fix implied by x402. The capability truth table already flags split UX. If you execute this, plan **migration** for Studio users on credits (gateway metering, bootstrap, settings). Do not assume credits and x402 are mutually exclusive in code without a full audit.

**3. “Fix ERC-8004 sync UX”**  
**Done in code:** `RegistryAgentsPanel.tsx` treats **501** explicitly; the sync control is **gated by `NEXT_PUBLIC_ERC8004_SYNC_ENABLED`** (default off) so the button stays disabled until ops enable it when the indexer ships.

### P1 — Hardening

**4. “Deploy audit service with SLA”**  
Align with **`AUDIT_SERVICE_URL`** and existing **optional vs required** behavior in the truth table. New `audit-service-deployment.yaml` under `infra/k8s/` should match **your** image names, namespaces, and **Kustomize** layout (`base/` + `overlays/production/`), not a one-off `infra/k8s/production/` path that does not exist in this repo.

**5. “OTel collector Deployment”**  
Traces fail when **`OTEL_*` endpoints are unreachable** (ops), not because Python hardcodes localhost. Prefer **env + collector sidecar / cluster service** documented in runbooks; optional **`infra/observability/`** compose stack exists for local/Grafana-style setups.

**6. “Add security policy evaluator”**  
**Already present:** `security_policy_evaluator_agent` is in **`workflow.py`**; **`SECURITY.md`** describes the **`SecurityVerdict`** pipeline (`services/orchestrator/security/`). New `policy_evaluator.py` would **duplicate** `evaluator.py` / schemas unless it replaces them in a deliberate refactor.

### P2 / P3 — Quality

**7–9 (evals CI, circuit breakers, Grafana JSON)**  
Reasonable roadmap items; **no canonical `pnpm eval:run`** or `circuit_breaker.py` in tree was verified in this review. Add workflows and libs only after defining **commands and owners**.

**10. E2E examples**  
Assertions like “POST `/workflows` always 402 without payment” are **not valid** without checking **which routes** are x402-gated vs **internal/credits** paths. Write tests against **real OpenAPI** and gateway behavior.

### “10/10” wording

**10/10** is not a repo-enumerable score. Use **explicit SLOs** (x402 settlement rate, pipeline success, audit latency, trace export success) and **checklists per environment** instead of a single numeric label.
