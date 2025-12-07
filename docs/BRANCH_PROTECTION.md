# Branch Protection Rules

This document describes the branch protection rules and requirements for the HyperAgent repository, following Microsoft Engineering Fundamentals standards.

## Overview

The `main` branch is protected and requires:
- **2+ approvers** for all pull requests
- **All CI checks must pass** before merging
- **Squash merge only** (clean commit history)
- **No direct pushes** to main branch

## Required Status Checks

The following checks must pass before a PR can be merged:

### Code Quality
- `[*] Code Quality Checks` - Black, isort, MyPy
- `[*] Frontend Code Quality` - ESLint, Prettier (if configured)

### Security
- `[*] Security Scan` - Bandit, Trivy vulnerability scanning

### Testing
- `[TEST] Unit Tests` - Unit test suite with 80%+ coverage
- `[TEST] Integration Tests` - Integration test suite
- `[TEST] Frontend Tests` - Frontend test suite (if configured)

### Build
- `[BUILD] Docker Image` - Docker image build
- `[TEST] Docker Compose Integration` - Docker Compose health check

## Setting Up Branch Protection

### Via GitHub UI

1. Navigate to **Settings** → **Branches**
2. Under **Branch protection rules**, click **Add rule**
3. Configure the following:

#### Branch Name Pattern
```
main
```

#### Protect Matching Branches

**Required Settings:**
- ✅ Require a pull request before merging
  - ✅ Require approvals: **2**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Select all required status checks (listed above)
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches: **No one** (or specific teams)

**Merge Settings:**
- ✅ Allow squash merging
- ❌ Allow merge commits
- ❌ Allow rebase merging (optional, can enable if preferred)

#### Save the Rule

Click **Create** to save the branch protection rule.

### Via GitHub API

```bash
# Set branch protection rules via API
curl -X PUT \
  -H "Authorization: token YOUR_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/JustineDevs/HyperAgent/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "[*] Code Quality Checks",
        "[*] Frontend Code Quality",
        "[*] Security Scan",
        "[TEST] Unit Tests",
        "[TEST] Integration Tests",
        "[TEST] Frontend Tests",
        "[BUILD] Docker Image",
        "[TEST] Docker Compose Integration"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 2,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": true
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

## Pull Request Requirements

### Before Creating a PR

1. **Update your branch** from main:
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-feature
   git rebase main
   ```

2. **Run local checks**:
   ```bash
   # Backend
   black --check hyperagent/
   isort --check-only hyperagent/
   mypy hyperagent/
   pytest tests/unit/ -v --cov=hyperagent --cov-report=term --fail-under=80
   
   # Frontend
   cd frontend
   npm ci
   npm run lint
   npm run format:check
   npm test
   ```

3. **Ensure all tests pass locally**

### PR Checklist

When creating a PR, ensure:
- [ ] PR description follows the template (`.github/pull_request_template.md`)
- [ ] All CI checks pass
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)
- [ ] No hardcoded secrets or credentials
- [ ] Branch is up to date with main

### Review Process

1. **Automated Review**: CODEOWNERS file automatically assigns reviewers
2. **Code Review**: At least 2 reviewers must approve
3. **Status Checks**: All required checks must pass
4. **Merge**: Squash merge only (maintains clean history)

## Merge Options

### Squash Merge (Preferred)

Squash merge combines all commits into a single commit:
- ✅ Clean, linear history
- ✅ Easy to revert entire feature
- ✅ Follows Microsoft Engineering Fundamentals

**How to squash merge:**
1. PR must be approved by 2+ reviewers
2. All status checks must pass
3. Click **Squash and merge** button
4. Edit commit message if needed
5. Click **Confirm squash and merge**

### Rebase Merge (Optional)

If enabled, rebase merge creates a linear history:
- ✅ Linear commit history
- ⚠️ Preserves individual commits (may clutter history)

### Merge Commit (Not Recommended)

Merge commits are disabled:
- ❌ Creates merge commits in history
- ❌ Clutters git log
- ❌ Not aligned with Microsoft standards

## Bypassing Protection

Branch protection cannot be bypassed by:
- Repository administrators
- Organization owners
- Any user (enforced at organization level)

**Exception**: In emergency situations, branch protection can be temporarily disabled by repository administrators, but this should be:
- Documented in an issue
- Re-enabled immediately after
- Reviewed in post-mortem

## Troubleshooting

### PR Blocked by Status Checks

**Issue**: PR shows "Required status checks must pass"

**Solutions**:
1. Check which checks are failing
2. Fix the issues locally
3. Push changes to trigger new checks
4. Wait for all checks to pass

### PR Blocked by Review Requirements

**Issue**: PR shows "Review required"

**Solutions**:
1. Check CODEOWNERS file for assigned reviewers
2. Request review from code owners
3. Wait for 2+ approvals

### Branch Out of Date

**Issue**: PR shows "This branch is out of date"

**Solutions**:
1. Update your branch:
   ```bash
   git checkout feature/your-feature
   git rebase origin/main
   git push --force-with-lease
   ```
2. Or merge main into your branch:
   ```bash
   git checkout feature/your-feature
   git merge origin/main
   git push
   ```

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Microsoft Engineering Fundamentals](https://github.com/microsoft/Engineering-Fundamentals)
- [Contributing Guide](../CONTRIBUTING.md)
- [Pull Request Template](../.github/pull_request_template.md)

---

**Last Updated**: 2025-12-07  
**Maintained By**: HyperAgent Team

