# Remote Repository Setup

**Document Type**: How-To Guide (Goal-Oriented)  
**Category**: Development Workflow  
**Audience**: Developers, Maintainers  
**Location**: `docs/REMOTE_SETUP.md`

This guide explains the dual-remote setup for HyperAgent development and production repositories.

## Repository Structure

HyperAgent uses a dual-remote setup:

- **JustineDevs/HyperAgent** (`origin-dev`) - Development repository
  - Contains all branches (`development`, `main`, feature branches)
  - Includes tests, scripts, documentation
  - Used for active development

- **HyperionKit/HyperAgent** (`origin-prod`) - Production repository
  - Contains only `main` branch
  - Production-ready code only (no tests, scripts, docs)
  - Used for releases and production deployments

## Remote Configuration

### Current Setup

```bash
# List remotes
git remote -v

# Output:
# origin-dev    https://github.com/JustineDevs/HyperAgent.git (fetch)
# origin-dev    https://github.com/JustineDevs/HyperAgent.git (push)
# origin-prod   https://github.com/HyperionKit/HyperAgent.git (fetch)
# origin-prod   https://github.com/HyperionKit/HyperAgent.git (push)
```

### Branch Tracking

- `development` branch tracks `origin-dev/development`
- `main` branch tracks `origin-prod/main`

## Daily Workflow

### Development Work (JustineDevs)

```bash
# Work on development branch
git checkout development

# Make changes and commit
git add .
git commit -m "feat: new feature"

# Push to development repository
git push origin-dev development
```

### Production Release (HyperionKit)

```bash
# Sync main branch from development
bash scripts/sync_main_branch.sh

# Review changes
git log --oneline -5

# Push to production repository
git push origin-prod main

# Push tags (if any)
git push origin-prod --tags

# Switch back to development
git checkout development
```

## Commands Reference

### Push to Development

```bash
# Explicit push
git push origin-dev development

# Or use configured remote (if set)
git push
```

### Push to Production

```bash
# Explicit push
git push origin-prod main

# Push tags
git push origin-prod --tags
```

### Fetch from Both Remotes

```bash
# Fetch from development
git fetch origin-dev

# Fetch from production
git fetch origin-prod

# Fetch from both
git fetch --all
```

## Setting Up Remotes (First Time)

If you need to set up remotes from scratch:

```bash
# Remove existing origin (if needed)
git remote remove origin

# Add development remote
git remote add origin-dev https://github.com/JustineDevs/HyperAgent.git

# Add production remote
git remote add origin-prod https://github.com/HyperionKit/HyperAgent.git

# Configure branch tracking
git config branch.development.remote origin-dev
git config branch.main.remote origin-prod

# Verify setup
git remote -v
git branch -vv
```

## Authentication

### SSH Keys (Recommended)

Set up SSH keys for both GitHub accounts:

```bash
# Generate SSH key for JustineDevs
ssh-keygen -t ed25519 -C "justinedevs@example.com" -f ~/.ssh/id_ed25519_justinedevs

# Generate SSH key for HyperionKit
ssh-keygen -t ed25519 -C "hyperionkit@example.com" -f ~/.ssh/id_ed25519_hyperionkit

# Add to SSH config
cat >> ~/.ssh/config << EOF
Host github-justinedevs
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_justinedevs

Host github-hyperionkit
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_hyperionkit
EOF

# Update remotes to use SSH
git remote set-url origin-dev git@github-justinedevs:JustineDevs/HyperAgent.git
git remote set-url origin-prod git@github-hyperionkit:HyperionKit/HyperAgent.git
```

### Personal Access Tokens

Alternatively, use HTTPS with personal access tokens:

```bash
# Push with token
git push https://<token>@github.com/JustineDevs/HyperAgent.git development
```

## Troubleshooting

### Authentication Errors

If you get authentication errors:

1. **Check SSH keys:**
   ```bash
   ssh -T git@github.com
   ```

2. **Verify remote URLs:**
   ```bash
   git remote -v
   ```

3. **Test access:**
   ```bash
   git ls-remote origin-dev
   git ls-remote origin-prod
   ```

### Wrong Remote

If you accidentally push to the wrong remote:

```bash
# Check where you pushed
git log origin-dev/development
git log origin-prod/main

# If needed, reset and push to correct remote
git push origin-dev development --force  # Only if necessary
```

## Best Practices

1. **Always push development work to `origin-dev`**
2. **Only push production-ready code to `origin-prod`**
3. **Use sync script for production releases**
4. **Verify remotes before pushing**
5. **Tag releases on production repository**

## Additional Resources

- [Branch Workflow](./BRANCH_WORKFLOW.md) - Git branching strategy
- [Contributing Guide](../CONTRIBUTING.md) - Contribution workflow
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment

---

**Questions?** Open an issue on [GitHub](https://github.com/JustineDevs/HyperAgent/issues)

