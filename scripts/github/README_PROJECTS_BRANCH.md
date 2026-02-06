# Projects Branch - GitHub Projects Automation

## Purpose

The `projects` branch is dedicated **ONLY** to GitHub Projects automation and sprint planning. It does NOT contain implementation code.

## What Belongs on Projects Branch

### Automation Scripts
- `scripts/github/create_phase*_issues.py` - Issue creation scripts
- `scripts/github/create_type_field.py` - Field creation helper
- `scripts/github/verify_project9_setup.sh` - Verification script
- `scripts/github/fetch_project_ids.sh` - Project ID fetcher

### Issue Data
- `scripts/data/issues.csv` - Issue definitions
- `scripts/data/issues.yaml` - Alternative issue format (if used)

### Automation Documentation
- `scripts/docs/github-automation/*.md` - Automation guides
- `scripts/README.md` - Scripts documentation

### Configuration
- `.env.issue.example` - Environment template for automation
- `.gitignore` updates for automation files

## What Does NOT Belong on Projects Branch

### Implementation Code (belongs on `development` branch)
- `apps/` - Application code
- `agents/` - Agent implementations
- `packages/` - SDK and shared libraries
- `infra/` - Infrastructure code
- `contracts/` - Smart contracts
- `k8s/` - Kubernetes manifests (implementation)

### Project-Wide Configuration (belongs on `development` branch)
- `CLAUDE.md` - Project constitution
- `.cursorrules` - Cursor editor rules
- `llms.txt` - AI content manifest
- `.cursor/` - AI interaction structure
- `CODEOWNERS` - Code ownership (unless automation-specific)

### Documentation (belongs on `development` branch)
- `docs/spec/` - Architecture specs
- `docs/runbooks/` - Operational runbooks
- General project documentation

## Branch Workflow

1. **Work on automation** → Commit to `projects` branch
2. **Run automation scripts** → Create/update GitHub issues
3. **Keep branch updated** → Periodically merge `main` into `projects`
4. **Never merge** → `projects` branch never merges to `development` or `main`

## Current Status

You are on the `projects` branch. All automation work should be committed here.

