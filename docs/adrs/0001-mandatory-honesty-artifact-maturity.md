# ADR 0001: Honesty policy, artifact maturity, and sandbox lifecycle (full system design)

- **Status:** Accepted
- **Date:** 2026-04-03

## 1. Purpose

This ADR is the single specification for (a) what the product may claim in user-visible copy, and (b) how runtime classifies workflow output as draft, validated, production-ready, or blocked, plus lifecycle coverage flags. Implementations must match this document. Changes to behavior require a new ADR or an explicit revision of this one.

## 2. Problem statement

Generated smart contract code and DApp scaffolding are not universally safe or “production-ready” in the legal or operational sense. Marketing, Studio copy, and status labels must not imply guarantees the platform does not enforce. The platform still needs machine-readable status so users and UIs can tell apart untrusted generation, gates passed without deploy, on-chain deploy recorded, and failed or blocked runs.

## 3. Claims policy (normative)

Applies to README, project constitution text, Studio root metadata, hero or login marketing, and comparable surfaces.

**Disallowed as guarantees**

- Fixed time to production (for example “under two minutes”).
- “Production-ready” as a blanket promise on generated output.
- “Audited contracts” as if a professional audit or end-to-end security guarantee existed.
- “Optional x402 metering” for v0.1.0 if the intended product contract is x402-backed payment gating on supported user flows.
- “Observability-first” or “secure by design” as absolute guarantees without qualification.

**Required framing**

- **Positioning:** AI-assisted workflow from natural language to draft artifacts, automated checks, audit workflow stages (static analysis and fuzzing tools), Tenderly or equivalent simulation when the pipeline and environment run it, and deploy preparation or execution when gates and user approval allow.
- **Artifacts:** Default framing is **draft artifacts with checks**, not shipped production guarantees.
- **Audit:** Use **audit workflow** or **security tooling in the pipeline**, not “audited” as a final certification.
- **Deploy:** Use **prepare deploy** or **deploy when gates pass**, not unconditional “deploy in minutes.”
- **Payments:** For v0.1.0, describe x402 as the required payment wall on supported SKALE Base user flows. If repo behavior still allows credits-first or x402-disabled paths, describe that as a gap, not as an intended product option.
- **Telemetry:** **Metrics and tracing** where the deployment wires them, not a promise of full production SRE coverage.
- **Storage:** Describe artifact storage in terms of configured providers and retention policies actually enforced by the product, not generic “IPFS/Filecoin” as if all paths used both.

## 4. Runtime concepts

### 4.1 Workflow record (logical model)

A workflow aggregate includes at least:

- Identifiers: `workflow_id`, optional `project_id`, timestamps.
- Pipeline: `status`, `current_stage`, `stages` (list of `{ stage|name, status, ... }`).
- Content: `spec`, `contracts` (map path to source), `test_files`, `ui_schema`, `deployments` (list of objects that may include `contract_address` or `address`).
- Gates: `audit_passed` (boolean, persisted when pipeline completes), `audit_findings`, `simulation_passed`, `simulation_results`, `invariant_violations`, optional `security_check_failed`.
- Metadata: `metadata` or `meta_data` for errors and ancillary fields.

`audit_passed` is written when the pipeline job finishes from the final graph state. Maturity logic prefers this field when present; stage lists are fallback for older rows.

### 4.2 Computed-only fields

These are **not** a second source of truth stored independently. They are derived on every read from the aggregate:

- `artifact_maturity`: `draft` | `validated` | `production_ready` | `blocked`
- `sandbox_lifecycle`: fixed-key object of booleans (see section 6)

Enrichment happens in the workflow store layer after loading the record from memory or database and normalizing `contracts`.

## 5. Artifact maturity algorithm (normative)

Inputs: workflow dictionary `w` as in section 4.1.

**5.1 Stage index**

Build `st` as a map from stage name to lowercased status string. For each item in `w.stages`, take `name = (item.stage or item.name).strip()`; if empty skip; set `st[name] = lower(item.status)`.

**5.2 Blocked (highest priority)**

Return `blocked` if any holds:

- `lower(w.status) == "failed"`.
- `lower(w.current_stage)` is one of: `audit_failed`, `simulation_failed`, `scrubd_failed`, `exploit_sim_failed`, `failed`.
- Any of `st[security_check]`, `st[scrubd]`, `st[audit]`, `st[simulation]`, `st[guardian]`, `st[exploit_sim]`, `st[deploy]` equals `"failed"`.
- `w.invariant_violations` contains an object whose `severity` lowercases to `high`, `critical`, or `error`.
- `w.security_check_failed` is truthy.
- `w.audit_passed` is exactly `False`.
- `st[simulation] == "failed"`.

**5.3 Production-ready**

If not blocked: let `deps = w.deployments or []`. If any element is a dict with non-empty `contract_address` or `address`, and either `lower(w.status)` is in `completed`, `success`, `deployed`, or `lower(w.current_stage)` is `deployed` or `ui_scaffold`, return `production_ready`.

**5.4 Draft**

If not blocked and not production-ready: if `w.contracts` is empty or missing, return `draft`.

**5.5 Validated**

If not blocked, not production-ready, and contracts exist:

- `audit_ok = (w.audit_passed is True) or (w.audit_passed is None and st[audit] == "completed")`.
- `sim_ok = (w.simulation_passed is True) or (w.simulation_passed is None and st[simulation] == "completed")`.
- If `audit_ok` and `sim_ok` and `st[exploit_sim] != "failed"`, return `validated`.

**5.6 Default**

Return `draft`.

## 6. Sandbox lifecycle coverage (normative)

Inputs: same `w`. Build `st` as in 5.1. Let `contracts = w.contracts or {}`.

Return this object (all keys always present):

| Key | True when |
|-----|-----------|
| `spec_intake` | `w.spec` is truthy |
| `contract_scaffold` | `contracts` non-empty |
| `frontend_scaffold` | `w.ui_schema` is truthy |
| `validation_gates` | `st[audit] == "completed"` and `st[test_generation] == "completed"` |
| `simulation` | `w.simulation_passed` is truthy or `st[simulation] == "completed"` |
| `deploy` | `w.deployments` is truthy (non-empty list) |
| `monitor_post_deploy` | `st[monitor] == "completed"` |

These flags mean **evidence exists on this run**, not that the full DApp lifecycle is complete, secure, or production-operated.

## 7. Pipeline persistence

When a background pipeline job completes, the final graph state must persist at minimum: `contracts`, `stages`, `status`, `current_stage`, `deployments`, `audit_findings`, `simulation_passed`, `simulation_results`, `audit_passed`, `test_files`, `ui_schema`, and error fields as today. Persisting `audit_passed` is required so maturity does not depend only on stage strings for new runs.

## 8. API and client contract

- Any endpoint that returns a full workflow body must include computed `artifact_maturity` and `sandbox_lifecycle` after load.
- List endpoints that return workflow summaries should include the same computed fields when the underlying record is full enough to compute them; thin rows may omit or leave maturity as default derivable from status only.
- TypeScript clients should model optional `artifact_maturity` and `sandbox_lifecycle` on the workflow type.

## 9. Studio UI

- A compact **maturity badge** may show one of: Draft, Validated, Production-ready, Blocked, styled by severity. Tooltip or adjacent copy must state that this is **pipeline gate status**, not a legal or third-party audit.
- Badges belong on workflow list or activity views where users scan run health; they must not replace detailed stage or error panels.

## 10. Testing obligations

- Unit tests must cover: blocked on failed status; draft with contracts but incomplete gates; validated with audit and simulation satisfied; production-ready with deployment address and completed status; lifecycle map keys for a fully populated synthetic record.
- Regression: changing section 5 or 6 requires updating tests in the same change.

## 11. Out of scope for this ADR

The following are **not** specified here: typed intermediate representation for whole DApp specs, app-wide E2E simulation harness, centralized policy engine with thresholds, full metrics catalog, or rollback automation. Those are separate designs. This ADR does not block adding them later; it defines honesty and maturity only.

## 12. Revision rule

Any change to the claims policy (section 3), maturity algorithm (section 5), or lifecycle keys (section 6) must update this document in the same commit as the code change, or add a superseding ADR that states what changed.
