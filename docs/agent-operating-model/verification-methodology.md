# Verification methodology

Verification is **structured confirmation of behavior** with pass/fail, separate from unit tests and from human code review.

## Verifier types

| Type | What it proves | Typical artifacts |
|------|----------------|-------------------|
| **API verifier** | HTTP contracts, auth, error shape | Scripted calls, contract tests, OpenAPI conformance |
| **UI verifier** | Critical paths render and respond | Playwright or equivalent; accessibility smoke |
| **CLI verifier** | Commands exit codes and stdout contracts | Shell scripts in CI |
| **Workflow verifier** | End-to-end pipeline stages | Orchestrator integration test, staging run |
| **Security verifier** | Static analysis, dependency audit | Slither, npm audit gates where applicable |

## Acceptance criteria

Each verifier declares:

- **Preconditions** (env, seed data, feature flags)
- **Steps**
- **Expected outputs** (status codes, fields, UI markers)
- **Cleanup** (teardown order, no resource leaks)

## Rerun and update rules

- **Rerun** the same verifier after any change to the covered contract.
- If the product intentionally changes behavior, **update the verifier first or in the same PR** as the code change.
- Flaky verifiers must be fixed or quarantined with an owner; do not “retry until green” without tracking.

## Verification failure vs feature failure

| Signal | Classification | Action |
|--------|----------------|--------|
| Verifier expected `201` but got `401` | Likely **implementation or auth regression** | Block merge; fix code or test env |
| Verifier expected old copy or selector | **Verifier drift** | Update verifier to current UX copy or DOM contract |
| External service down | **Environment / dependency** | Retry policy; not a pass for prod promotion |

## Separation of concerns

- **Unit tests** prove components in isolation.
- **Verification** proves externally visible behavior and workflows.
- **Human review** catches intent and design; it does not replace verifiers for regressions.

## Failure recovery

On verifier failure:

1. Capture logs and correlation IDs.
2. Classify per table above.
3. If feature failure: fix forward with new verifier evidence.
4. If environment failure: fix infra or pin dependencies; do not weaken assertions.

See [recovery-runbook.md](recovery-runbook.md) for operational retries and stale state.

---

**Index:** [Agent operating model](README.md)
