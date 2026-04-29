# Hyperagent Full-System Adversarial Truth Audit

**Branch:** `devin/1777456075-full-system-audit` (off `main`)
**Initiated:** 2026-04-29
**Scope:** all 10 workstreams in the system directive (committed, no descope)

This directory contains the deliverables for the principal-systems-auditor pass
across `apps/*`, `services/*`, `packages/*`, `infra/*`, `.github/workflows/*`.

## Layout

| File | Workstreams |
| ---- | ----------- |
| `findings.json` | Machine-readable inventory of every finding (id, severity, file, evidence, fix). |
| `00-severity-report.md` | Human-readable, severity-ranked report of the highest-impact findings. |
| `01-ownership-matrix.md` | Real ownership map per domain (auth, wallet, prompt, workflow, audit, simulation, deploy, billing, …). WS1. |
| `02-scenario-matrix.md` | Realistic / sad / edge / race / retry / downgrade scenario coverage and execution status. WS2. |
| `03-route-verification.md` | Frontend → gateway → orchestrator route-by-route verification. WS7. |
| `04-drift-matrix.md` | UI ↔ api-contracts ↔ gateway ↔ orchestrator ↔ DB ↔ docs/concept-claim drift table. WS3. |
| `05-duplicate-matrix.md` | Duplicate ownership / validation / startup / config table. WS6. |
| `06-legacy-deadcode-matrix.md` | Legacy / unused / dead / stale-but-dangerous code with risk class. WS5. |
| `07-harness-gaps.md` | What current tests would NOT catch, plus the harnesses added in this PR. WS8. |
| `08-runtime-proof/` | Real execution evidence: test runs, service logs, route probes. WS10. |

## Workstream status snapshot

> See `findings.json` for the canonical state. This table is a quick read.

| WS | Title | Status |
| -- | ----- | ------ |
| WS1 | Ownership map | DONE (static) |
| WS2 | Scenario matrix | PARTIAL — matrix produced; only api-gateway slice executed in this pass |
| WS3 | Drift detection | DONE — concrete drift cases enumerated |
| WS4 | Incorrect-logic testing | PARTIAL — failure-class tests added in api-gateway and ai-tools; full-pipeline gating proof requires live stack |
| WS5 | Legacy / unused / dead | DONE |
| WS6 | Duplicates / confusion / bad practice | DONE |
| WS7 | Route + state + dataflow truth | PARTIAL — static route map verified; live dataflow proof requires Docker stack |
| WS8 | Test-harness strength | PARTIAL — gaps enumerated; new tests added; full mutation-style harness deferred |
| WS9 | Fix or quarantine | PARTIAL — six high-severity items fixed in this PR (F-001/F-002 docs; F-007 dead allow-list entry; F-019 stage validator; F-025 + F-027 orphan router mounts); harness added for F-004/F-019 + F-025/F-027 regressions; long-tail tracked in findings.json |
| WS10 | Real execution proof | PARTIAL — `pnpm test` runtime proof captured (89/89 in api-gateway including new parity harnesses); full Docker compose stack run BLOCKED on host (see WS10 blocker note in `findings.json` and `08-runtime-proof/`) |

The user directive forbids silent descope. Every PARTIAL row above carries a
specific `next_action` field in `findings.json` and is left in COMMITTED state
with the precise blocker called out. None of the workstreams are marked DONE
unless the evidence in this directory backs it up.

## Blocker policy

`BLOCKED` is only used after a harness has been built and the failure is
externally caused. Each blocker entry in `findings.json` includes:

- `blocker.reason` — what fails and why
- `blocker.evidence` — exact failing command / log
- `blocker.harness_added` — the code/test added in this PR to reduce the
  blocker surface
- `blocker.next_action` — what the next pass needs to unblock it
