# Canonical Ownership and Gates

This document is the repo-level source of truth for shared contract ownership and merge-blocking CI surfaces.

## Canonical Owners

| Surface | Canonical owner | Notes |
| --- | --- | --- |
| API paths, public/private route classification, HTTP error envelope | `packages/api-contracts` | Shared by Studio and gateway |
| Workflow stages and UI bucket derivation | `packages/workflow-state` | Python writes must remain parity-tested against this package |
| Runtime env parsing and safe defaults | `packages/config` | Fail-closed production semantics belong here |
| Workflow graph, run lifecycle, approvals, persistence semantics | `services/orchestrator` | Studio reflects this state; it does not author it |
| User authn, ingress rate limit, metering, gateway→orchestrator identity injection | `apps/api-gateway` | The only canonical ingress trust boundary |
| Feature-classification honesty (`enforced`, `optional`, `experimental`, `roadmap`) | `docs/control-plane/capability-truth-table.md` | Documentation and UI claims must agree with this file |

## Canonical PR Gate

The merge-blocking PR workflow surface is:

- `.github/workflows/pr-validation.yml`

No other workflow should be treated as the authoritative PR gate.

## Required Check Names

These names are intended to remain stable for branch protection / rulesets:

- `contract:artifacts-diff`
- `contract:schema-registry-validate`
- `contract:openapi-lint`
- `contract:schemathesis-public-smoke`
- `quality:python`
- `quality:typescript`
- `db:migrations-verify`
- `test:backend`
- `test:frontend`
- `build:gateway`

Path-gated or conditionally skipped jobs must not be part of the required-check set.

The GitHub-facing manifest for these checks is stored in:

- [`.github/required-checks.json`](/mnt/c/users/justinedevs/downloads/hyperkit_agent/.github/required-checks.json:1)

## Main and Release Gates

- `.github/workflows/ci.yml` is the canonical post-merge **Main Gate**.
- `.github/workflows/release.yml` is the canonical **Release Gate**.

Specialized workflows such as CodeQL, Semgrep, Gitleaks, docs, or contract fuzzing remain useful, but they are supporting workflows, not the canonical PR gate.

## Local Reproduction

The closest local reproduction path for the canonical PR gate is:

```bash
pnpm run ci:gate:pr
```

This covers contract generation/linting plus the local preflight lane. CI-only checks that depend on service containers or repository-hosted runners remain separately enforced in GitHub Actions.

## Related runbook

- [Repo gates runbook](../runbooks/repo-gates-runbook.md)
