# Branch Protection Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-06  
**Owner:** @ArhonJay (CTO)

---

## Overview

This guide provides step-by-step instructions for configuring branch protection rules for HyperAgent's GitFlow strategy using GitHub CLI and GitHub UI.

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Admin access to `hyperkit-labs/Hyperkit_agent` repository
- Required status checks configured in GitHub Actions

## Branch Protection Rules

### 1. Main Branch (Production)

**Purpose:** Protect production-ready code

```bash
# Set branch protection for main
gh api repos/hyperkit-labs/Hyperkit_agent/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/tests-backend","ci/tests-frontend","ci/tests-contracts","ci/security-scan","ci/lint"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":2,"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"require_last_push_approval":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field block_creations=false \
  --field required_conversation_resolution=true \
  --field lock_branch=false \
  --field allow_fork_syncing=false
```

**Or via GitHub UI:**
1. Go to: `Settings > Branches`
2. Add rule for `main`
3. Configure:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: **2**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners
   - ✅ Require last push approval
   - ✅ Require status checks to pass before merging
     - ✅ `ci/tests-backend`
     - ✅ `ci/tests-frontend`
     - ✅ `ci/tests-contracts`
     - ✅ `ci/security-scan`
     - ✅ `ci/lint`
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings
   - ❌ Allow force pushes
   - ❌ Allow deletions

### 2. Develop Branch (Staging)

**Note:** Current repository has `development` branch. Either:
- Rename `development` → `develop` for GitFlow compliance
- Or configure `development` as the integration branch

**Option A: Rename branch (Recommended)**

```bash
# Rename development to develop
git checkout development
git branch -m develop
git push origin develop
git push origin --delete development

# Update default branch (if needed)
gh api repos/hyperkit-labs/Hyperkit_agent \
  --method PATCH \
  --field default_branch=develop
```

**Option B: Use development as integration branch**

```bash
# Set branch protection for development
gh api repos/hyperkit-labs/Hyperkit_agent/branches/development/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci/tests-backend","ci/tests-frontend","ci/lint"]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":false,"require_code_owner_reviews":true,"require_last_push_approval":false}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field block_creations=false \
  --field required_conversation_resolution=true \
  --field lock_branch=false \
  --field allow_fork_syncing=false
```

**Or via GitHub UI:**
1. Go to: `Settings > Branches`
2. Add rule for `develop` (or `development`)
3. Configure:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: **1**
   - ❌ Dismiss stale pull request approvals
   - ✅ Require review from Code Owners
   - ✅ Require status checks to pass before merging
     - ✅ `ci/tests-backend`
     - ✅ `ci/tests-frontend`
     - ✅ `ci/lint`
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ❌ Do not allow bypassing (admins can override)
   - ❌ Allow force pushes
   - ❌ Allow deletions

### 3. Projects Branch (GitHub Projects Automation)

```bash
# Set branch protection for projects
gh api repos/hyperkit-labs/Hyperkit_agent/branches/projects/protection \
  --method PUT \
  --field required_status_checks='{"strict":false,"contexts":["ci/lint"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":false,"require_code_owner_reviews":false,"require_last_push_approval":false}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field block_creations=false \
  --field required_conversation_resolution=false \
  --field lock_branch=false \
  --field allow_fork_syncing=false
```

**Or via GitHub UI:**
1. Go to: `Settings > Branches`
2. Add rule for `projects`
3. Configure:
   - ✅ Require a pull request before merging
   - ✅ Require approvals: **1**
   - ❌ Dismiss stale pull request approvals
   - ❌ Require review from Code Owners (automation scripts)
   - ✅ Require status checks to pass before merging
     - ✅ `ci/lint` (if applicable)
   - ❌ Require branches to be up to date (can merge from main)
   - ❌ Require conversation resolution
   - ✅ Do not allow bypassing (admins can override for automation)
   - ❌ Allow force pushes
   - ❌ Allow deletions

## Verify Protection Rules

```bash
# Check main branch protection
gh api repos/hyperkit-labs/Hyperkit_agent/branches/main/protection

# Check develop branch protection
gh api repos/hyperkit-labs/Hyperkit_agent/branches/develop/protection

# Check projects branch protection
gh api repos/hyperkit-labs/Hyperkit_agent/branches/projects/protection
```

## Required Status Checks Setup

Ensure these status checks are configured in GitHub Actions:

### 1. Create Status Check Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  tests-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... test steps
    outputs:
      status: ${{ job.status }}

  tests-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... test steps

  tests-contracts:
    name: Contract Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... test steps

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... security scan steps

  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... lint steps
```

### 2. Register Status Checks

After workflows run successfully, they automatically appear in branch protection settings. Or manually add:

```bash
# Status checks are automatically registered after first successful run
# No manual registration needed
```

## CODEOWNERS Configuration

Ensure `.github/CODEOWNERS` is configured:

```bash
# Verify CODEOWNERS exists
cat .github/CODEOWNERS

# Test CODEOWNERS syntax
gh api repos/hyperkit-labs/Hyperkit_agent/contents/.github/CODEOWNERS
```

## Testing Protection Rules

### Test Main Branch Protection

```bash
# Try to push directly to main (should fail)
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "test: direct push to main"
git push origin main
# Expected: Error - branch is protected
```

### Test PR Requirements

```bash
# Create feature branch
git checkout -b test/feature-branch
echo "test" >> test.txt
git add test.txt
git commit -m "test: feature"
git push origin test/feature-branch

# Create PR to main
gh pr create --base main --title "Test PR" --body "Testing protection rules"

# Try to merge without approvals (should fail)
# Expected: PR cannot be merged without 2 approvals
```

## Troubleshooting

### Status Checks Not Appearing

```bash
# Check workflow runs
gh run list --branch main

# Re-run failed checks
gh run rerun <run-id>

# Check workflow status
gh api repos/hyperkit-labs/Hyperkit_agent/actions/runs
```

### Cannot Merge PR

1. Check required status checks: `gh pr view <pr-number>`
2. Ensure all checks pass: `gh pr checks <pr-number>`
3. Verify approvals: `gh pr view <pr-number> --json reviews`
4. Check CODEOWNERS: Ensure reviewers match CODEOWNERS rules

### Bypass Protection (Emergency Only)

```bash
# Only for emergencies - use GitHub UI
# Settings > Branches > [Branch] > Edit > Uncheck "Do not allow bypassing"
# Or use admin override in PR merge button
```

## References

- [GitHub Branch Protection API](https://docs.github.com/en/rest/branches/branch-protection)
- [Branch Protection Documentation](./BRANCHING_STRATEGY.md#branch-protection-rules)
- [CODEOWNERS File](../.github/CODEOWNERS)

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | @ArhonJay | Initial branch protection setup guide |

