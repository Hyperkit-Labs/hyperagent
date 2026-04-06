# HyperAgent capability truth table (Phase 1 inventory)

This document classifies major capabilities by **observed code behavior**, not marketing copy. It is the baseline for closing gaps between claims and implementation.

**Legend**

| Class | Meaning |
| ----- | ------- |
| **REAL + enforced** | Code path exists; failure modes block or surface clearly in intended environments |
| **REAL + optional** | Works when deps are configured; safe skip or degrade when not |
| **REAL + fragile** | Works but exception paths, fail-open, or weak typing risk wrong outcomes |
| **PARTIAL** | Some paths real; others stub, skipped, or inconsistent |
| **STUB** | Explicit placeholder or fake success |
| **ARCHITECTED ONLY** | Config/YAML/docs without runtime enforcement |
| **CLAIMED NOT IMPLEMENTED** | README/UI implies presence; code does not deliver end-to-end |
| **IMPLEMENTED NOT USER-VISIBLE** | Backend exists; Studio or API does not expose clearly |
| **USER-VISIBLE NOT ENFORCED** | UI suggests certainty; server does not prove it |

---

## Studio (Next.js)

| Feature | Class | Notes (evidence direction) |
| ------- | ----- | --------------------------- |
| Workflow create / poll | REAL + optional | Depends on gateway + orchestrator + Supabase |
| BYOK LLM keys | REAL + enforced | Server paths expect user keys where designed |
| Agents page (pipeline agents) | REAL | `getAgents` from orchestrator |
| A2A registry panel | USER-VISIBLE NOT ENFORCED | Lists DB mirror; sync was stub-like; **POST /erc8004/sync now returns 501** (no fake success) |
| Payments / credits UI | USER-VISIBLE NOT ENFORCED | Legacy credits-first UI still ships even though the v0.1.0 product contract is x402-first on SKALE Base |
| x402 client UX | PARTIAL | Product contract says x402 is mandatory, but current UX is split between legacy credits surfaces and env-gated x402 proof paths |

---

## API gateway

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Proxy `/api/v1` → orchestrator | REAL + enforced | Primary API path |
| Rate limit (Upstash REST) | REAL + optional | When env present |
| Identity HMAC | REAL + optional | `ENFORCE` flags in docs |
| x402 on protected routes | PARTIAL | v0.1.0 contract requires x402 on supported user flows, but repo behavior is still gated by `X402_ENABLED` and internal users can skip |

---

## Orchestrator

| Feature | Class | Notes |
| ------- | ----- | ----- |
| LangGraph pipeline (spec→…→deploy) | REAL + fragile | Queue/worker/Redis required for production scale |
| Audit (`run_security_audits` → audit service) | REAL + optional | **Requires `AUDIT_SERVICE_URL` and running audit service**; circuit breaker |
| Audit gating (`compute_audit_deploy_blocked`) | REAL + enforced | When audit completes; findings drive `audit_passed` |
| Tenderly simulation | REAL + optional | `TENDERLY_SIMULATION_REQUIRED` fail-closed when Tenderly missing and env true |
| `trace_writer` / IPFS traces | PARTIAL | Real CID when IPFS configured; **production raises if stub blob** (see `trace_writer.py`); `write_trace_sync` can still return stub on exception |
| ERC-8004 on-chain register (`erc8004_register.py`) | REAL + optional | Needs `ERC8004_REGISTER_PRIVATE_KEY` + chain in registry YAML |
| **POST /api/v1/erc8004/sync** | **STUB → fixed** | **Was 200 + `synced: 0` (theater). Now 501 until indexer exists** |
| Agent registry CRUD (Supabase mirror) | REAL + enforced | When DB migrated |
| Credits / billing | PARTIAL | Legacy credits path remains in repo and conflicts with the intended x402-first launch contract |
| x402 middleware | PARTIAL | Proof verification exists, but current behavior still treats x402 as env-gated instead of mandatory by default |

---

## Audit service (external)

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Slither / Mythril / etc. | REAL + optional | Must be deployed and reachable; orchestrator calls HTTP |
| “Mandatory” in README | CLAIMED NOT IMPLEMENTED | **Overclaim** unless deploy guarantees audit service always up and fail-closed when down |

---

## Simulation (Tenderly / provider)

| Feature | Class | Notes |
| ------- | ----- | ----- |
| `run_tenderly_simulations` | REAL + optional | Marks skipped when Tenderly not configured; can fail pass when `TENDERLY_SIMULATION_REQUIRED` |
| Deploy prepare gate | PARTIAL | `ENFORCE_SIMULATION_BEFORE_DEPLOY`, `mainnet_guard`, security verdict — verify each deploy entry |

---

## Runtime / deploy

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Thirdweb / prepare deploy | REAL + optional | Chain and wallet deps |
| Agent-runtime simulate | PARTIAL | TypeScript path; align with orchestrator gates |

---

## Credits / billing

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Stripe / credits Supabase | REAL + optional | Env and schema dependent |
| Reconciliation worker | REAL + optional | Thread in orchestrator startup |

---

## Supabase / RLS

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Migrations | REAL + enforced | Apply via `pnpm db:apply-migrations` |
| RLS + service_role policies | REAL + fragile | Must verify with `verify-rls-policies.sql` |

---

## Storage / provenance

| Feature | Class | Notes |
| ------- | ----- | ----- |
| IPFS pin (`ipfs_client`) | REAL + optional | Stub traces when not configured (dev); production trace writer errors on stub when `IS_PRODUCTION` |
| Pinata webhook | REAL + optional | When wired |
| Filecoin / “durable” claims | ARCHITECTED ONLY / CLAIMED | **Treat as roadmap unless explicit upload path is proven** |

---

## Chain integrations

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Chain registry YAML | REAL + optional | Not equal to “all chains production-ready” |
| Multi-chain README bullets | CLAIMED NOT IMPLEMENTED | **Narrow to SKALE Base Mainnet and SKALE Base Sepolia for v0.1.0; other entries are roadmap** |

---

## Observability

| Feature | Class | Notes |
| ------- | ----- | ----- |
| OpenTelemetry hooks | REAL + optional | `OPENTELEMETRY_ENABLED`, OTLP endpoints |
| Structured logs / request id | REAL + fragile | Present; dashboard completeness varies |
| “Metrics and tracing” README | PARTIAL | **Dashboards not guaranteed by repo alone** |

---

## Workflow persistence

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Runs / run_steps in Supabase | REAL + optional | Falls back to in-memory when DB off (not production-safe) |
| Stub trace detection API (`runs_registry`) | REAL + enforced | Exposes `trace_verifiable: false` for stub blob ids |

---

## Docs / README

| Feature | Class | Notes |
| ------- | ----- | ----- |
| Pipeline tool list (Slither, MythX, …) | CLAIMED NOT IMPLEMENTED | **Must match what deploy actually runs and fails on** |
| A2A + ERC-8004 sentences | PARTIAL | On-chain registration exists in code paths; **bulk sync was not real until indexer** |

---

## Summary counts (approximate)

- **STUB** or **theater** addressed in this pass: ERC-8004 **sync** HTTP contract (was fake success).
- **Largest remaining honesty gaps**: x402-first contract drift versus current repo behavior, multi-chain readiness claims beyond SKALE Base, full audit-service availability guarantees, trace exception path in `write_trace_sync`, eval harness, operational dashboards.
