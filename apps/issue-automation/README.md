# Issue Automation

GitHub Projects Issues Automation app for HyperAgent.

## Overview

This app handles GitHub issue creation, project management, and workflow automation for the HyperAgent project.

## Structure

- `github/` - GitHub automation scripts (create issues, update projects)
- `issue-fetch/` - Scripts to fetch and convert issues to markdown

## Setup

1. Copy `.env.issue.example` to `.env.issue.local`
2. Fill in your GitHub token and repository details
3. Install dependencies: `pnpm install`

## Usage

### Fetch Issues

```bash
cd apps/issue-automation
python issue-fetch/fetch_my_issues.py --assignee JustineDevs --summary
```

### Convert Issues to Markdown

```bash
python issue-fetch/convert_issues_to_markdown.py --assignee JustineDevs
```

### Create Phase 1 Issues

```bash
python github/create_phase1_issues.py --csv ../../tools/scripts/data/issues.csv
```

## Environment Variables

See `.env.issue.example` for required variables.

## CI/CD

This app is built and deployed separately from the main platform. CI workflows use path filters:

```yaml
paths:
  - "apps/issue-automation/**"
  - ".github/workflows/issue-automation-*"
```

