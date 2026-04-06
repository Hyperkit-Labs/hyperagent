# Git Commit Automation Guide

This repository includes a CLI for git commit management with parallel processing and security checks. Built with composable commands (cli-building skill) and optional Linear integration (linear-cli skill).

## Quick Start

### CI preflight (before commit)

`pnpm run commit` runs **`pnpm run ci:preflight`** first unless you skip it. Preflight runs **`pnpm turbo run lint typecheck test --continue`** (see `scripts/ci-preflight.cjs`), then optionally black, isort, and mypy on `services/orchestrator/` if Python tools are installed.

| Skip | When |
|------|------|
| `pnpm run commit -- --skip-preflight` | Emergency only; not recommended on shared branches |
| `COMMIT_SKIP_PREFLIGHT=1 pnpm run commit` | Same as `--skip-preflight` |
| `PREFLIGHT_SKIP_PYTHON=1 pnpm run ci:preflight` | Skips Python quality checks but still runs Turbo |

**Stronger parity with GitHub Actions** (before you push): `pnpm run ci:preflight:full` runs the same Turbo + Python steps as `ci:preflight`, then the gateway/middleware build chain and a Studio production build with CI-like `NEXT_PUBLIC_*` env (see `scripts/ci-preflight-full.cjs`). Preflight installs `services/orchestrator/requirements-mypy.txt` so mypy has `types-PyYAML`, matching the lint job. Jobs that need Postgres (migrations, RLS setup, integration pytest) still require a local DB or CI.

Run preflight alone anytime:

```bash
pnpm run ci:preflight
pnpm run ci:preflight:full   # optional: add gateway + Studio build gates
```

### CLI (Recommended)

```bash
# Default: ci:preflight, then parallel commit with security checks (stages all with git add -A unless --no-stage-all)
pnpm run commit
# or: node .github/version/scripts/commit/cli/index.js commit

# Preview what will be committed
pnpm run commit:dry

# Security check only
pnpm run security:check

# Linear issue trailer (requires linear CLI)
node .github/version/scripts/commit/cli/index.js linear
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `commit` | Parallel commit with security checks (default) |
| `security` | Scan staged/working dir for sensitive files |
| `linear` | Print Linear issue trailer for commit messages |

### Legacy Scripts

```bash
# Bash version (no Node.js)
pnpm run commit:sh
pnpm run commit:sh:dry

# Single commit for all changes
pnpm run commit:all
```

## What the Scripts Do

1. **Scan for Changes**: Automatically detects all modified, added, or deleted files
2. **Security Checks**: **NEW** - Automatically blocks commits of sensitive files (.env, secrets, credentials, etc.)
3. **Generate Commit Messages**: Diff-parser extracts specific changes from `git diff --word-diff` (no LLM); Regex Router for .ts/.js, package.json, .css/.scss
4. **Parallel Processing**: Commits multiple files simultaneously for speed
5. **Smart Filtering**: Excludes build artifacts, logs, and temporary files
6. **Space-Safe Handling**: Properly handles files and directories with spaces using double quotes
7. **Error Handling**: Continues processing even if individual commits fail

## Security Features

The scripts now include **automatic security checks** to prevent committing sensitive files:

### Blocked Files (Will Fail Commit)
- `.env` files (except `.env.example`, `.env.template`, `.env.sample`)
- Secret files (`.secrets`, `credentials.json`, `service-account.json`)
- Certificate and key files (`.pem`, `.key`, `.cert`, `.p12`, `.pfx`, `.jks`)
- MCP config with secrets (`.cursor/mcp.json` - if it contains secrets)
- Backup files (`.env.backup`, `*.env.*.backup`)

### Allowed Files (Safe to Commit)
- `.env.example`
- `.env.template`
- `.env.sample`
- `.cursor/mcp.json.example`
- `.cursor/mcp.example.json`

### Security Options

```bash
# Default: Security checks enabled, fails on sensitive files
pnpm run commit

# Warn only (not recommended for production)
node .github/version/scripts/commit/parallel-commit.js --warn-only

# Disable security checks (NOT RECOMMENDED)
node .github/version/scripts/commit/parallel-commit.js --no-security-check
```

## Commit Message Generation (Diff-Parser, No LLM)

The script uses `git diff -U0 --word-diff` to extract specific changed "words" and generates highly specific messages without an LLM:

| Scenario | Example |
|----------|---------|
| Word-diff match | `useNetworks.ts – Updated signal to undefined, signal` |
| .ts/.js (Regex Router) | `page.tsx – Modified getExplorerUrl` |
| package.json | `package.json – Upgraded react to 18.2.0` |
| .css/.scss | `styles.css – Changed color to #fff` |
| New file | `feat: add README.md in docs` |
| Deleted | `remove: delete old-file.txt` |
| Renamed | `refactor: rename component.js in src/components` |
| Fallback | `update: modify script.js in hooks` |

## Configuration

### Adjust Concurrency
```bash
# Limit to 3 concurrent commits
bash .github/version/scripts/commit/parallel-commit.sh --max 3
```

### Staging

By default the commit flow runs **`git add -A`** so new and untracked files are included. To only commit paths already known to git:

```bash
pnpm run commit -- --no-stage-all
```

### Exclude Files
Edit the `excludePatterns` in `.github/version/scripts/commit/parallel-commit.js`:
```javascript
excludePatterns: [
  'node_modules/**',
  '.git/**',
  '*.log',
  '*.tmp',
  '.DS_Store',
  'Thumbs.db'
]
```

## Workflow Examples

### Daily Development
```bash
# 1. Make your changes
# 2. Preview what will be committed
pnpm run commit:dry

# 3. Commit all changes (runs ci:preflight first)
pnpm run commit

# 4. Push to remote
git push
```

### Large Refactoring
```bash
# For many files, use limited concurrency
bash .github/version/scripts/commit/parallel-commit.sh --max 2

# Or commit everything at once
pnpm run commit:all
```

### Safe Testing
```bash
# Always test first with dry run
pnpm run commit:dry

# Then commit for real
pnpm run commit
```

## Troubleshooting

### Common Issues

1. **Script not found**: Make sure you're in the repository root
2. **Permission denied**: Run `chmod +x .github/version/scripts/commit/parallel-commit.sh`
3. **Node.js not found**: Use the bash version instead
4. **No changes**: Script will tell you if there's nothing to commit
5. **Preflight fails**: Fix lint, typecheck, or tests (or run `pnpm run ci:preflight` to see the same output). Use `--skip-preflight` only when you accept skipping those gates.

### Performance Tips

- Use `--max 3` for slower systems
- Use `pnpm run commit:all` for bulk changes
- Always run `pnpm run commit:dry` first to preview

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm run ci:preflight` | Turbo lint, typecheck, test; optional Python on orchestrator |
| `pnpm run commit` | CLI: parallel commit with security checks |
| `pnpm run commit:dry` | CLI: preview what would be committed |
| `pnpm run commit:cli` | CLI: full interface (commit \| security \| linear) |
| `pnpm run commit:sh` | Bash script version |
| `pnpm run commit:sh:dry` | Bash script dry run |
| `pnpm run commit:all` | Single commit for all changes |
| `pnpm run commit:auto` | CLI commit with max 3 concurrent |
| `pnpm run security:check` | CLI: security scan only |
| `pnpm run status` | Show git status |
| `pnpm run changes` | Show changed files |
| `pnpm run staged` | Show staged files |

## Security Best Practices

### Before Committing

Always run a security check:
```bash
pnpm run security:check
```

This will:
- ✅ Check if `.env` is in `.gitignore`
- ✅ Scan staged files for sensitive data
- ✅ Scan working directory for sensitive files
- ✅ Warn about potential security issues

### If Sensitive Files Are Detected

1. **Remove from staging**:
   ```bash
   git reset HEAD .env
   ```

2. **Ensure in .gitignore**:
   ```bash
   echo ".env" >> .gitignore
   ```

3. **If already committed**:
   ```bash
   # Remove from git history (use with caution)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

4. **Revoke exposed credentials**:
   - GitHub: https://github.com/settings/tokens
   - Other services: Revoke immediately

### Example Files (Safe to Commit)

These files are **allowed** and safe to commit:
- ✅ `.env.example`
- ✅ `.env.template`
- ✅ `.env.sample`
- ✅ `.cursor/mcp.json.example`

## Benefits

- **Security**: Automatic detection and blocking of sensitive files
- **Speed**: Parallel processing commits multiple files simultaneously
- **Intelligence**: Automatic commit message generation
- **Safety**: Dry-run mode prevents accidental commits
- **Flexibility**: Multiple options for different use cases
- **Cross-platform**: Works on Windows, macOS, and Linux

## Troubleshooting Security Issues

### Issue: "Commit blocked for security reasons"

**Solution**: 
1. Check which files are sensitive: `pnpm run security:check`
2. Remove sensitive files from staging: `git reset HEAD <file>`
3. Ensure files are in `.gitignore`
4. Use `.env.example` as a template instead

### Issue: False positives (file incorrectly flagged)

**Solution**:
- If it's a legitimate example file, ensure it matches allowed patterns:
  - Must end with `.example`, `.template`, or `.sample`
  - Or be in `.cursor/` with `.example` in the name
- For other cases, you can temporarily use `--warn-only` (not recommended)

Script snippets to copy into the root `package.json` are in `.github/version/scripts/commit/package.json.txt`.
