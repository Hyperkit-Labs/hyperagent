# Secret Scanning Fix: Remove .env from Commit History

**Date:** 2026-02-06  
**Issue:** GitHub secret scanning detected secrets in `.env` file in commit history  
**Status:** ⚠️ Action Required

---

## Problem

GitHub's secret scanning detected a secret in `.env` file at line 74 in the commit history. The push was rejected:

```
remote: Secret detected: path: .env:74
remote: push declined due to repository rule violations
```

Even though `.env` is now in `.gitignore` and removed from tracking, it still exists in the Git history, exposing secrets.

## Solution: Remove .env from Git History

### Option 1: Interactive Rebase (Recommended for Recent Commits)

If `.env` was added in recent commits:

```bash
# Find the commit that added .env
git log --all --source --full-history -- .env

# Interactive rebase to remove .env from commits
git rebase -i <commit-before-env-was-added>

# In the editor, change 'pick' to 'edit' for commits with .env
# Then remove .env from each commit:
git rm --cached .env
git commit --amend --no-edit
git rebase --continue
```

### Option 2: Filter-Branch (For Entire History)

Remove `.env` from entire Git history:

```bash
# Create backup branch first
git branch backup-before-cleanup

# Remove .env from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (requires force-push permission)
git push origin --force --all
git push origin --force --tags
```

### Option 3: BFG Repo-Cleaner (Fastest, Recommended)

BFG is faster and safer than filter-branch:

```bash
# Download BFG (if not installed)
# https://rtyley.github.io/bfg-repo-cleaner/

# Remove .env from history
java -jar bfg.jar --delete-files .env

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
```

### Option 4: Use GitHub's Unblock URL (If False Positive)

If the detected secret is not actually sensitive or is a test value:

1. Visit the unblock URL provided in the error:
   ```
   https://github.com/Hyperkit-Labs/hyperagent/security/secret-scanning/unblock-secret/39IA1i34w9zkvLE1f6zxTNJ1CF5
   ```

2. Review the detected secret
3. If it's safe, click "Allow secret"
4. Retry the push

**⚠️ Warning:** Only use this if you're certain the secret is not sensitive.

## Recommended Approach

For the `projects` branch:

```bash
# 1. Check which commits contain .env
git log --all --oneline -- .env

# 2. If it's only in recent commits, use interactive rebase
git rebase -i HEAD~5  # Adjust number as needed

# 3. For each commit with .env:
#    - Change 'pick' to 'edit'
#    - Run: git rm --cached .env
#    - Run: git commit --amend --no-edit
#    - Run: git rebase --continue

# 4. Force push (if branch protection allows)
git push origin projects --force-with-lease
```

## Prevention

To prevent this in the future:

1. **Always add `.env` to `.gitignore` BEFORE first commit**
2. **Use `.env.example` as template (safe to commit)**
3. **Use pre-commit hooks to block `.env` files**
4. **Use GitHub Secrets for CI/CD instead of `.env` files**

## Create .env.example Template

```bash
# Copy .env to .env.example
cp .env .env.example

# Remove all actual values, keep structure
# Replace secrets with placeholders:
# GITHUB_TOKEN=your_github_token_here
# DATABASE_URL=postgresql://user:password@host:port/dbname

# Add to repository (safe to commit)
git add .env.example
git commit -m "docs: add .env.example template"
```

## Verification

After cleaning history:

```bash
# Verify .env is not in history
git log --all --source --full-history -- .env
# Should return nothing

# Verify .env is ignored
git check-ignore .env
# Should return: .env

# Test push
git push origin projects
# Should succeed without secret scanning errors
```

## References

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [Git Filter-Branch](https://git-scm.com/docs/git-filter-branch)

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | @ArhonJay | Secret scanning fix guide |

