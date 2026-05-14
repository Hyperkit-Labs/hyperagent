# Repo Gates Runbook

Operator checklist for turning the repo's canonical workflow design into actual GitHub enforcement.

## Canonical sources

- Required checks manifest: [`.github/required-checks.json`](/mnt/c/users/justinedevs/downloads/hyperkit_agent/.github/required-checks.json:1)
- Ownership and gate definitions: [canonical-ownership-and-gates.md](/mnt/c/users/justinedevs/downloads/hyperkit_agent/docs/control-plane/canonical-ownership-and-gates.md:1)

## Branch protection / rulesets

Apply to:

- `main`
- `development`

Recommended repository ruleset settings:

- Require pull request before merge
- Require at least 1-2 reviews based on your team policy
- Require all required status checks to pass
- Require branches to be up to date before merging
- Require linear history
- Restrict force-push
- Restrict deletion
- Minimize admin bypass to explicit break-glass owners only

Required checks must match the exact names in `.github/required-checks.json`.

## Checks that must stay advisory

Do **not** mark these as required:

- path-gated jobs
- security reporting jobs that intentionally `continue-on-error`
- PR formatting / labeling helpers
- Docker advisory builds that are not part of the canonical merge gate

## Release controls

- Restrict who can create `v*` tags
- Only create release tags from green `main`
- Keep the root `package.json` version equal to the release tag version without the `v` prefix
- Use GitHub Environment reviewers for `production`

## Public vs private repo note

GitHub artifact attestations in private repositories may require GitHub Enterprise Cloud. The release workflow already guards provenance attestation steps to public repos only where necessary. If your plan supports private-repo attestations, remove that conditional and enforce attestation verification for all releases.

## Local contributor command

Before opening or updating a PR, contributors should run:

```bash
pnpm run ci:gate:pr
```

This is the closest local reproduction of the canonical PR Gate.
