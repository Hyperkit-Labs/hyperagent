# Branch Workflow Guide

**Document Type**: How-To Guide (Goal-Oriented)  
**Category**: Development Workflow  
**Audience**: Developers, Contributors  
**Location**: `BRANCH_WORKFLOW.md`

This guide explains the branch structure and workflow for HyperAgent development and production releases.

## Branch Structure

### `development` (Default Branch)

**Purpose**: Active development branch with all files

**Contains**:
- ✅ All source code (`hyperagent/`)
- ✅ All tests (`tests/`)
- ✅ All scripts (`scripts/`)
- ✅ All documentation (`docs/`, `GUIDE/`)
- ✅ Examples (`examples/`)
- ✅ Development configuration files

**Usage**: 
- Default branch for all development work
- All feature branches should branch from `development`
- All pull requests target `development`

### `main` (Production Branch)

**Purpose**: Production-ready code only

**Contains**:
- ✅ Production source code (`hyperagent/`)
- ✅ Essential configuration files
- ✅ Production documentation (README.md, LICENSE, etc.)
- ❌ **Excludes**: `tests/`, `scripts/`, `docs/`, `GUIDE/`, `examples/`

**Usage**:
- Only updated when ready for production release
- Clean, minimal codebase for production deployment
- Used for releases and production deployments

## Workflow

### Daily Development (on `development` branch)

```bash
# 1. Ensure you're on development branch
git checkout development

# 2. Pull latest changes
git pull origin development

# 3. Create feature branch
git checkout -b feature/your-feature-name

# 4. Make changes, commit
git add .
git commit -m "feat: your feature description"

# 5. Push feature branch
git push origin feature/your-feature-name

# 6. Create Pull Request targeting development branch
```

### Production Release (sync `main` from `development`)

```bash
# Option 1: Use sync script (recommended)
bash scripts/sync_main_branch.sh

# Option 2: Manual sync
git checkout development
git pull origin development
git checkout main
git merge development --no-edit
# Remove development files manually
rm -rf tests/ scripts/ docs/ GUIDE/ examples/ pytest.ini
git add -A
git commit -m "chore: remove development files for production release"
git push origin main
git checkout development
```

### After Syncing Main Branch

```bash
# 1. Review changes
git log --oneline -5

# 2. Push main branch to remote
git push origin main

# 3. Switch back to development
git checkout development
```

## Files Excluded from `main` Branch

The following files/directories are automatically removed from `main` branch:

- `tests/` - All test files (unit, integration, performance, load)
- `scripts/` - Development and utility scripts
- `docs/` - Internal technical documentation
- `GUIDE/` - Developer and user guides
- `examples/` - Example workflow files
- `pytest.ini` - Test configuration
- `.cursor/` - IDE-specific files
- `*.plan.md` - Planning documents

## Setting Default Branch

### On GitHub

1. Go to repository **Settings** → **Branches**
2. Under **Default branch**, select `development`
3. Click **Update**
4. Confirm the change

### Protect Main Branch (Recommended)

1. Go to repository **Settings** → **Branches**
2. Click **Add rule** for `main` branch
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

## Sync Script Usage

### Linux/macOS/Git Bash

```bash
bash scripts/sync_main_branch.sh
```

### Windows (Command Prompt/PowerShell)

```cmd
scripts\sync_main_branch.bat
```

The sync script will:
1. Switch to `development` branch
2. Pull latest changes
3. Create/update `main` branch
4. Merge `development` into `main`
5. Remove development-only files
6. Commit the changes

## Best Practices

### ✅ Do's

- Always work on `development` branch for new features
- Use feature branches for larger changes
- Sync `main` only when ready for production release
- Review `main` branch changes before pushing
- Keep `development` branch up to date

### ❌ Don'ts

- Don't commit directly to `main` branch
- Don't push development files to `main` branch
- Don't skip the sync script when updating `main`
- Don't force push to `main` branch

## Troubleshooting

### Sync Script Fails

If the sync script fails:

1. **Check current branch**: `git branch`
2. **Ensure development branch exists**: `git branch -a`
3. **Manually sync**:
   ```bash
   git checkout development
   git checkout -b main  # or git checkout main if exists
   git merge development
   # Remove files manually
   git add -A
   git commit -m "chore: remove development files"
   ```

### Accidentally Committed to Main

If you accidentally committed development files to `main`:

```bash
git checkout main
# Remove files
rm -rf tests/ scripts/ docs/ GUIDE/ examples/
git add -A
git commit -m "chore: remove development files"
git push origin main
```

### Reset Main Branch

If you need to completely reset `main` branch:

```bash
git checkout development
git branch -D main  # Delete local main
git checkout -b main  # Create fresh main from development
bash scripts/sync_main_branch.sh  # Clean it up
```

## Related Documentation

- **[Contributing Guidelines](./CONTRIBUTING.md)** - Contribution process
- **[Developer Guide](./GUIDE/DEVELOPER_GUIDE.md)** - Development setup
- **[Git Workflow](./.cursor/rules/dev-workflow.mdc)** - Standard development workflow

