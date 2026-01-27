# Branch Protection Rules

## Main Branch Protection

The `main` branch is protected and requires the following for all merges:

### Required Status Checks

- [ ] Build passes (`npm run build` in all packages)
- [ ] Tests pass (`npm test` with 70%+ coverage)
- [ ] Linter passes (`npm run lint`)
- [ ] Type checking passes (`tsc --noEmit`)

### Required Reviews

- **Minimum**: 2 approvals from code owners
- **Dismiss stale reviews**: Enabled
- **Require review from CODEOWNERS**: Enabled

### Merge Restrictions

- **Allowed merge methods**: Squash and merge (preferred), Rebase and merge
- **Blocked merge methods**: Merge commit
- **Require linear history**: Recommended but not enforced

### Branch Rules

- **No direct pushes**: All changes must go through Pull Requests
- **No force pushes**: Protected
- **Require conversation resolution**: Enabled
- **Require up-to-date branches**: Enabled

## Branch Naming Conventions

### Feature Branches
- Format: `feature/description-of-feature`
- Example: `feature/add-telemetry-logging`

### Fix Branches
- Format: `fix/description-of-fix`
- Example: `fix/memory-leak-in-chroma-client`

### Hotfix Branches
- Format: `hotfix/description-of-hotfix`
- Example: `hotfix/security-patch-for-deployment`

### Release Branches
- Format: `release/v1.2.3`
- Example: `release/v1.0.0`

## Workflow

1. Create feature branch from `main`
2. Make changes and commit
3. Push branch and create Pull Request
4. Wait for 2+ approvals and all checks to pass
5. Squash merge to `main`
6. Delete feature branch

## Exceptions

Emergency hotfixes may bypass some checks with explicit approval from:
- Project maintainers
- Security team (for security fixes)

## Enforcement

These rules are enforced via GitHub branch protection settings.
See repository settings for current configuration.

