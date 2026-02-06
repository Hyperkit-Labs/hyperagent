# Team Collaboration Guide

This guide explains how the HyperAgent team collaborates, manages sprints, uses scripts, and follows best practices for effective development.

## Table of Contents

- [Team Structure](#team-structure)
- [Branch Strategy](#branch-strategy)
- [Sprint Implementation Workflow](#sprint-implementation-workflow)
- [Scripts and Automation](#scripts-and-automation)
- [Do's and Don'ts](#dos-and-donts)
- [Avoiding Common Pitfalls](#avoiding-common-pitfalls)
- [Git Best Practices](#git-best-practices)
- [Code Review Process](#code-review-process)
- [Communication Guidelines](#communication-guidelines)

## Team Structure

### Team Members and Responsibilities

**JustineDevs (CPOO/Product Lead)**
- Orchestration, GitOps, DevOps, Documentation, Backend
- Primary areas: `orchestration`, `infra`, `gitops`, `docs`, `backend`, `api`
- Reviews: Backend architecture, infrastructure, documentation

**ArhonJay (CTO/Project Architect)**
- SDKs, CLI, SDK-related features
- Primary areas: `sdk-cli`, SDK features, SDK documentation
- Reviews: SDK architecture, CLI tools, technical decisions

**Tristan-T-Dev (CMFO/Frontend)**
- Frontend, UI/UX, public pitches, demos
- Primary areas: `frontend`, UI components, user experience
- Reviews: Frontend code, UI/UX decisions, design patterns

### Assignment Areas

Each team member has specific areas of ownership. When working on code in these areas, ensure the appropriate reviewer is included:

- **Backend/API**: JustineDevs, ArhonJay
- **Frontend/UI**: Tristan-T-Dev
- **SDK/CLI**: ArhonJay
- **Infrastructure/DevOps**: JustineDevs, ArhonJay
- **Documentation**: JustineDevs
- **Smart Contracts**: ArhonJay

## Branch Strategy

HyperAgent uses **GitFlow** branching strategy for structured development and release management.

### Branch Types

| Branch | Purpose | Source | Merge To | Lifespan |
|--------|---------|--------|----------|----------|
| `main` | Production-ready code | - | - | Permanent |
| `development` | Integration branch | `main` | `main` (via release) | Permanent |
| `feature/*` | New features | `development` | `development` | Short-lived |
| `bugfix/*` | Bug fixes | `development` | `development` | Short-lived |
| `release/*` | Release preparation | `development` | `main` + `development` | Until merged |
| `hotfix/*` | Critical production fixes | `main` | `main` + `development` | Short-lived |
| `chore/*` | Maintenance tasks | `development` | `development` | Short-lived |

### Branch Naming Convention

```bash
# Format: <type>/<issue-number>-<short-description>

feature/ISSUE-123-supabase-schema
bugfix/ISSUE-150-rate-limiting
hotfix/ISSUE-200-security-patch
chore/ISSUE-160-update-deps
release/v0.1.0
```

### Standard Workflow

1. **Start Feature Work**
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/ISSUE-123-description
   ```

2. **Develop and Commit**
   ```bash
   # Make changes
   git add .
   git commit -m "feat(area): description of changes

   - Detail 1
   - Detail 2
   
   Relates to: #123"
   ```

3. **Push and Create PR**
   ```bash
   git push -u origin feature/ISSUE-123-description
   # Create PR to development branch via GitHub
   ```

4. **After Merge**
   ```bash
   git checkout development
   git pull origin development
   git branch -d feature/ISSUE-123-description  # Delete local branch
   ```

## Sprint Implementation Workflow

### Sprint Planning

1. **Review Sprint Issues**
   - Check `docs/implementation/sprints/` for sprint summaries
   - Review assigned issues in `docs/implementation/by-assignee/`
   - Sync issues from GitHub: `python apps/issue-automation/src/fetch_my_issues.py`

2. **Convert Issues to Markdown**
   - Issues are automatically tracked in `docs/implementation/issues/`
   - Each issue has a markdown file: `{issue-number}-{slugified-title}.md`
   - Update these files as you work on issues

3. **Create Feature Branches**
   - One branch per issue (or related issues)
   - Follow naming: `feature/ISSUE-123-description`

### During Sprint

1. **Work on Issues**
   - Update issue markdown files with progress
   - Commit frequently with clear messages
   - Use the parallel commit script for organized commits

2. **Track Progress**
   - Update checklists in issue markdown files
   - Document implementation decisions
   - Link related PRs and commits

3. **Regular Sync**
   - Pull latest `development` branch regularly
   - Rebase feature branches if needed (see Git Best Practices)
   - Keep issue markdown files in sync with GitHub

### Sprint Completion

1. **Finalize Work**
   - Ensure all PRs are merged to `development`
   - Update issue markdown files with completion status
   - Document any follow-up work needed

2. **Sprint Review**
   - Review completed issues
   - Update sprint summary in `docs/implementation/sprints/`
   - Identify blockers or improvements

## Scripts and Automation

### Parallel Commit Script

The parallel commit script automatically groups your changes into logical commits by file type (frontend, backend, docs, config).

**Usage:**
```bash
# Dry run to see what would be committed
npm run commit:dry

# Actually commit (groups changes automatically)
npm run commit

# Limit to 3 commits maximum
npm run commit:auto
```

**How it works:**
The script detects all uncommitted changes, groups them by type (frontend, backend, docs, config, other), and creates separate commits for each group. This keeps your git history clean and organized. It automatically stages all changes and creates conventional commit messages.

**Example output:**
```
Planning 2 commit(s):
  1. [docs] docs: update 6 file(s)
     Files: docs/GUIDE/..., docs/implementation/...
  2. [backend] feat(backend): update API routes
     Files: apps/hyperagent-api/...
```

### Issue Tracking Scripts

**Fetch Issues:**
```bash
# Fetch all your assigned issues from GitHub
python apps/issue-automation/src/fetch_my_issues.py
```

**Convert to Markdown:**
```bash
# Convert issues to markdown files for tracking
python apps/issue-automation/src/convert_issues_to_markdown.py \
  --assignee JustineDevs \
  --output-dir docs/implementation/issues
```

**Understanding the scripts:**
These scripts sync GitHub issues with local markdown files in `docs/implementation/issues/`. Each issue becomes a markdown file you can update as you work, keeping implementation notes, progress checklists, and decisions in one place. The scripts handle fetching, converting, and syncing automatically.

## Do's and Don'ts

### ✅ Do's

**Branch Management**
- ✅ Always branch from `development` for new features
- ✅ Keep feature branches focused on one issue or related issues
- ✅ Pull latest `development` before creating new branches
- ✅ Delete merged branches (local and remote)
- ✅ Use descriptive branch names with issue numbers

**Commits**
- ✅ Use conventional commit format: `type(scope): description`
- ✅ Write clear, descriptive commit messages
- ✅ Commit frequently with logical units of work
- ✅ Reference issue numbers in commit messages
- ✅ Use the parallel commit script for organized commits

**Code**
- ✅ Follow project coding standards (see `.cursorrules`)
- ✅ Write self-documenting code
- ✅ Add comments for complex logic
- ✅ Update documentation with code changes
- ✅ Run tests before committing

**Pull Requests**
- ✅ Create PRs early for visibility
- ✅ Write clear PR descriptions
- ✅ Link related issues in PR description
- ✅ Request appropriate reviewers based on code areas
- ✅ Respond to review feedback promptly
- ✅ Keep PRs focused and reasonably sized

**Documentation**
- ✅ Update issue markdown files as you work
- ✅ Document implementation decisions
- ✅ Keep README files current
- ✅ Update API documentation with changes

### ❌ Don'ts

**Branch Management**
- ❌ Don't commit directly to `main` or `development`
- ❌ Don't create branches from outdated branches
- ❌ Don't leave stale branches around
- ❌ Don't force push to shared branches
- ❌ Don't rebase commits that exist outside your repository (see Git Best Practices)

**Commits**
- ❌ Don't commit broken code
- ❌ Don't commit large binary files
- ❌ Don't commit secrets or credentials
- ❌ Don't write vague commit messages
- ❌ Don't squash commits that others have based work on

**Code**
- ❌ Don't ignore linter warnings
- ❌ Don't skip tests
- ❌ Don't copy-paste code without understanding
- ❌ Don't leave TODO comments without issue links
- ❌ Don't commit commented-out code

**Pull Requests**
- ❌ Don't create massive PRs (break into smaller ones)
- ❌ Don't ignore review feedback
- ❌ Don't merge your own PRs without review
- ❌ Don't close PRs without explanation
- ❌ Don't create PRs with failing CI checks

## Avoiding Common Pitfalls

### Pitfall 1: Merge Conflicts

**Problem:** Multiple people working on same files causes conflicts.

**Solution:**
- Pull `development` regularly: `git pull origin development`
- Rebase feature branch: `git rebase origin/development`
- Resolve conflicts immediately, don't let them accumulate
- Communicate with team about overlapping work

**Prevention:**
- Coordinate on shared files before starting work
- Keep feature branches small and focused
- Merge to `development` frequently

### Pitfall 2: Outdated Branches

**Problem:** Feature branch becomes too far behind `development`.

**Solution:**
```bash
# Rebase your feature branch on latest development
git checkout feature/ISSUE-123-description
git fetch origin
git rebase origin/development
# Resolve any conflicts
git push --force-with-lease origin feature/ISSUE-123-description
```

**Prevention:**
- Start new features from latest `development`
- Rebase regularly during development
- Keep feature branches short-lived

### Pitfall 3: Lost Work

**Problem:** Accidentally deleting or losing uncommitted work.

**Solution:**
- Commit frequently (even with WIP commits)
- Use `git stash` for temporary work
- Create backup branches for experimental work
- Use `git reflog` to recover lost commits

**Prevention:**
- Commit early and often
- Push branches to remote regularly
- Don't force delete branches without checking

### Pitfall 4: Breaking Main Branch

**Problem:** Merging broken code to `main` or `development`.

**Solution:**
- Always run tests before merging
- Use CI/CD checks (don't bypass)
- Test in staging environment first
- Use release branches for stabilization

**Prevention:**
- Require CI checks to pass before merge
- Use branch protection rules
- Code review all changes
- Test locally before pushing

### Pitfall 5: Incomplete Documentation

**Problem:** Code changes without updated documentation.

**Solution:**
- Update docs as part of the same PR
- Include documentation in definition of done
- Use issue markdown files to track doc updates
- Review documentation in code reviews

**Prevention:**
- Make documentation part of the workflow
- Use PR templates that include doc checklist
- Review docs in same PR as code

## Git Best Practices

### Never Rebase Shared Commits

**Critical Rule:** Do not rebase commits that exist outside your repository and that people may have based work on.

**Why:**
- Rebasing rewrites history
- If others have pulled your commits, rebasing breaks their local branches
- Causes confusion and lost work
- Violates Git's golden rule

**When it's safe to rebase:**
- ✅ Commits only in your local repository
- ✅ Feature branch that no one else has pulled
- ✅ Before creating PR (first push)

**When NOT to rebase:**
- ❌ Commits already pushed to remote
- ❌ Commits others have pulled
- ❌ Commits in shared branches (`development`, `main`)
- ❌ After PR is created and reviewed

**Safe rebase workflow:**
```bash
# Safe: Rebase before first push
git checkout feature/ISSUE-123-description
git rebase origin/development
git push -u origin feature/ISSUE-123-description  # First push

# Safe: Rebase local commits only
git rebase -i HEAD~3  # Interactive rebase of last 3 local commits

# Unsafe: Rebase after others have pulled
git rebase origin/development  # If branch already exists on remote
git push --force  # This breaks others' local branches
```

**Alternative to rebasing:**
```bash
# Instead of rebasing, merge development into your branch
git checkout feature/ISSUE-123-description
git merge origin/development
# Resolve conflicts
git push origin feature/ISSUE-123-description
```

### Commit Message Format

Use conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(api): add user authentication endpoint

- Implement JWT token generation
- Add rate limiting middleware
- Update API documentation

Relates to: #123

fix(backend): resolve database connection leak

- Close connections properly in error cases
- Add connection pool monitoring
- Update error handling

Fixes: #150

docs(guide): update setup instructions for monorepo

- Add pnpm workspace setup
- Update Turbo commands
- Include troubleshooting section
```

### Branch Hygiene

**Keep branches clean:**
- Delete merged branches promptly
- Don't accumulate stale branches
- Use descriptive names
- One feature per branch

**Cleanup commands:**
```bash
# Delete local merged branches
git branch --merged development | grep -v "development\|main" | xargs git branch -d

# Delete remote merged branches
git branch -r --merged development | grep -v "development\|main" | sed 's/origin\///' | xargs -I {} git push origin --delete {}
```

## Code Review Process

### Creating a Pull Request

1. **Ensure your branch is ready:**
   - All tests pass
   - Code follows style guidelines
   - Documentation updated
   - Issue markdown file updated

2. **Create PR with clear description:**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Related Issue
   Closes #123
   
   ## Changes Made
   - Change 1
   - Change 2
   
   ## Testing
   - [ ] Unit tests added/updated
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] Tests added/updated
   - [ ] Issue markdown file updated
   ```

3. **Request appropriate reviewers:**
   - Based on code areas (see Team Structure)
   - At least one reviewer required
   - Two reviewers for `main` branch

### Reviewing Code

**As a reviewer:**
- Review within 24 hours if possible
- Be constructive and specific
- Ask questions, don't just criticize
- Approve when ready, request changes when needed
- Test the changes if possible

**Review checklist:**
- [ ] Code follows project standards
- [ ] Logic is correct and efficient
- [ ] Tests are adequate
- [ ] Documentation is updated
- [ ] No security issues
- [ ] No breaking changes (or documented)

## Communication Guidelines

### Daily Standups

- What you worked on yesterday
- What you're working on today
- Any blockers or help needed

### Issue Updates

- Update issue markdown files with progress
- Comment on GitHub issues for visibility
- Link PRs to issues when creating

### Blockers

- Communicate blockers immediately
- Use GitHub issue comments
- Tag relevant team members
- Don't wait for daily standup

### Questions

- Ask in GitHub issue comments
- Tag team members for specific areas
- Use PR comments for code-related questions
- Document answers in issue markdown files

## Quick Reference

### Common Commands

```bash
# Start new feature
git checkout development && git pull && git checkout -b feature/ISSUE-123-desc

# Commit changes (organized)
npm run commit

# Push and create PR
git push -u origin feature/ISSUE-123-desc
# Then create PR via GitHub UI

# Sync with development
git checkout development && git pull
git checkout feature/ISSUE-123-desc
git merge origin/development  # Or rebase if safe (see Git Best Practices)

# Clean up merged branches
git branch --merged development | grep -v "development\|main" | xargs git branch -d
```

### Issue Tracking

```bash
# Fetch your issues
python apps/issue-automation/src/fetch_my_issues.py

# Convert to markdown
python apps/issue-automation/src/convert_issues_to_markdown.py --assignee YourName

# Update issue file
# Edit docs/implementation/issues/ISSUE-123-description.md
```

### Getting Help

- **Git questions**: Check this guide, Git documentation, or ask team
- **Code questions**: Comment on related issue or PR
- **Process questions**: Ask in team chat or GitHub discussions
- **Blockers**: Tag team members in issue comments

## Additional Resources

- [Branching Strategy](../plan/BRANCHING_STRATEGY.md) - Detailed GitFlow documentation
- [Implementation Tracking](../implementation/README.md) - Issue tracking workflow
- [Simplified Setup Guide](../SIMPLIFIED_GUIDE.md) - Development environment setup
- [README](../../README.md) - Project overview and quick start

---

**Remember:** Good collaboration is about communication, respect, and following shared practices. When in doubt, ask the team!

