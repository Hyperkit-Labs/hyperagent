# Engineering honesty deliverables (master mandate)

This file tracks the **required deliverables** from the principal-engineer mandate: capability inventory, stub elimination, implementation plan, validation, and shipping truth. It is **not** a one-shot completion report; it is the working ledger.

## 1. Capability truth table

**Artifact:** [capability-truth-table.md](./capability-truth-table.md)

**Rule:** Update when behavior changes. Classifications must cite code paths or env contracts.

---

## 2. Stub elimination report

| Area | File / path | Prior behavior | New behavior (if any) | Residual risk |
| ---- | ------------- | -------------- | ----------------------- | ------------- |
| ERC-8004 bulk sync | `services/orchestrator/api/agent_lifecycle.py` `POST /erc8004/sync` | HTTP 200 + `synced: 0` (implied success) | **HTTP 501** with explicit `detail` string | Indexer still absent; UI must not imply sync works |
| Trace provenance | `services/orchestrator/trace_writer.py` | Stub `stub:…` when IPFS off | Unchanged in dev; **production raises** on stub blob when `IS_PRODUCTION` | `write_trace_sync` exception path can still return stub (documented as fragile) |
| Run step trace audit | `services/orchestrator/api/runs_registry.py` | Exposes `trace_verifiable` | Unchanged | Good pattern; keep |

**Open stubs (require future PRs):** resume checkpoint message in A2A API; debate “stub” trace note in `nodes.py`; any remaining `synced: 0` patterns in other services (search periodically).

---

## 3. Implementation plan (grouped)

| Area | Next actions |
| ---- | ------------ |
| Studio | Align labels with `trace_verifiable`; avoid “synced” until backend proves it |
| Gateway | Keep x402 and rate limits; document required env for “production-ready” |
| Orchestrator | Fail-closed audit when `AUDIT_SERVICE_URL` missing **if** product requires it; single simulation gate audit |
| Audit services | Health check + pipeline block when tools unavailable (policy decision) |
| Simulation | Single matrix: chain × `TENDERLY_SIMULATION_REQUIRED` × deploy gate |
| Registry sync | Implement indexer **or** keep 501 and remove hero claims |
| Provenance | Remove Filecoin wording until path exists; enforce pin success |
| Billing / x402 | Remove credits-first product copy, enforce x402 on supported SKALE Base flows, add paid vs unpaid integration tests, disable launch marketing while x402 can be off |
| Supabase | RLS audits; migration hygiene per `supabase/README.md` |
| Observability | Metric names for gate blocks; optional Grafana JSON |
| Docs | README follows truth table; support matrix per chain |

---

## 4. Exact code changes (this PR / session)

| File | Change |
| ---- | ------ |
| `services/orchestrator/api/agent_lifecycle.py` | `POST /erc8004/sync` → **501** Not Implemented |
| `services/orchestrator/tests/unit/test_agent_lifecycle_api.py` | Expect 501 and message |
| `apps/studio/components/agents/RegistryAgentsPanel.tsx` | User-facing copy for 501 |
| `docs/control-plane/capability-truth-table.md` | **New** Phase 1 inventory |
| `docs/control-plane/engineering-honesty-deliverables.md` | **New** this ledger |
| `README.md` | Honest security-tooling bullet; link to truth table |

---

## 5. Validation plan

| Layer | What to run |
| ----- | ----------- |
| Unit | `pytest services/orchestrator/tests/unit/test_agent_lifecycle_api.py` |
| Integration | Orchestrator + real Supabase + migration applied; call `/erc8004/sync` → 501 |
| E2E | Studio Agents page: Sync shows error text, not success |
| Env | Production: IPFS + trace writer rules; Tenderly when simulation required |
| Regression | Add CI job matrix for audit service mock vs absent (future) |

---

## 6. Shipping truth (direct answers)

| Question | Answer |
| -------- | ------ |
| What is fully real now? | Pipeline, audit **when service is up**, simulation **when Tenderly is up**, deploy gates **where wired**, trace CIDs **when IPFS is up**, registry DB rows **when migrated**, and some x402 plumbing |
| What remains partial? | Mandatory x402 enforcement on supported flows, legacy credits-first UI copy, multi-chain “support” vs SKALE-only launch scope, Filecoin/durable claims, full observability dashboards, eval harness, some exception paths in trace writer |
| What claims were removed or narrowed? | README “mandatory” security tooling wording, multi-chain launch copy, optional-x402 wording, ERC-8004 **sync** no longer pretends to succeed |
| What claims are now honest? | Security tooling depends on deploy; current launch scope is SKALE Base only; sync endpoint admits not implemented; x402 mismatch is called out as a gap |
| Is the product production-grade? | **Not as a blanket label.** Production-grade is **per deployment** when env, services, and migrations match the truth table |
| What still blocks that label? | End-to-end proof of mandatory x402 on supported flows, audit service SLA, indexer or removal of ERC-8004 sync UX, evals in CI, dashboard coverage |

---

## Phase coverage (mandate vs status)

| Phase | Status |
| ----- | ------ |
| 1 Inventory | **Done** (truth table v1) |
| 2 Stubs | **Partial** (ERC-8004 sync fixed; others backlog) |
| 3 Audit hardening | **Not done** (policy + code TBD) |
| 4 Simulation-first | **Partial** (code exists; matrix + UX TBD) |
| 5 ERC-8004 sync real | **Not done** (501 until indexer) |
| 6 Provenance | **Partial** (IPFS real; exceptions documented) |
| 7 x402 real | **Not done** (middleware exists, but launch contract still not enforced end to end) |
| 8 Multi-chain honesty | **Partial** (launch scope narrowed to SKALE Base in copy; runtime matrix still needs tests) |
| 9 Observability | **Not done** (emission + dashboards TBD) |
| 10 Evals | **Not done** |
| 11 Product states | **Not done** |
| 12 Supabase hardening | **Ongoing** (migrations + RLS audits) |
| 13 Docs | **Partial** (this pass + README tweak) |
| 14 Deliverables | **This document** |
