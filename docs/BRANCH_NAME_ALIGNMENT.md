# Branch Name Alignment: develop vs development

**Date:** 2026-02-06  
**Issue:** Local branch is `develop` but remote is `development`  
**Status:** ⚠️ Needs Resolution

---

## Current Situation

**Local Branch:**
- Branch name: `develop`
- Tracking: `origin/develop` (does not exist - shows as "gone")
- Status: Has commits not on remote

**Remote Branch:**
- Branch name: `development`
- Status: Exists on remote repository
- URL: `refs/heads/development`

## Why This Happened

1. **GitFlow Standard:** We renamed local branch from `development` to `develop` to follow GitFlow conventions
2. **Remote Not Updated:** The remote repository still has the old `development` branch name
3. **Tracking Broken:** Local `develop` is trying to track `origin/develop` which doesn't exist

## GitFlow Convention

According to GitFlow, the integration branch should be named `develop` (not `development`):
- `main` - Production branch
- `develop` - Integration branch (standard GitFlow name)
- `feature/*` - Feature branches
- `release/*` - Release branches
- `hotfix/*` - Hotfix branches

## Solution Options

### Option 1: Rename Remote Branch to `develop` (Recommended)

This aligns with GitFlow and our branching strategy:

```bash
# 1. Push local develop branch to remote (creates origin/develop)
git push origin develop

# 2. Set develop as default branch on GitHub (via web UI or CLI)
gh api repos/Hyperkit-Labs/hyperagent -X PATCH -f default_branch=develop

# 3. Delete old development branch from remote
git push origin --delete development

# 4. Update local tracking
git branch --set-upstream-to=origin/develop develop
```

**Benefits:**
- ✅ Aligns with GitFlow standard
- ✅ Matches our branching strategy documentation
- ✅ Consistent naming across team

### Option 2: Rename Local Branch to `development`

Match the remote branch name:

```bash
# 1. Rename local branch
git branch -m develop development

# 2. Update tracking
git branch --set-upstream-to=origin/development development

# 3. Switch to renamed branch
git checkout development
```

**Drawbacks:**
- ❌ Doesn't follow GitFlow convention
- ❌ Inconsistent with our documentation
- ❌ May confuse team members

## Recommended Action

**Use Option 2** - Rename local to `development`:

1. Matches existing remote branch name
2. Avoids breaking changes for team members
3. Maintains consistency with remote repository
4. No need to update GitHub default branch

## Steps to Execute (Option 2 - Rename Local to development)

### 1. Rename Local Branch

```bash
git branch -m develop development
```

### 2. Update Tracking

```bash
git branch --set-upstream-to=origin/development development
```

### 3. Switch to Renamed Branch

```bash
git checkout development
```

### 4. Verify

```bash
git branch -vv
# Should show: * development [origin/development] ...
```

### 5. Commit Current Changes

```bash
git add .
git commit -m "feat: add .cursor and k8s directories to development branch"
```

### 6. Push to Remote

```bash
git push origin development
```

## Current Branch Status

```
Local:  develop (tracking origin/develop - gone)
Remote: development (exists)
```

## After Alignment

```
Local:  development (tracking origin/development)
Remote: development (default branch)
```

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | @ArhonJay | Branch name alignment documentation |

