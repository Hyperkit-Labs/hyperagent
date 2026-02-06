# Implementation Tracking

This directory tracks implementation progress for GitHub issues.

## Structure

```
docs/implementation/
├── issues/              # Individual issue .md files
│   ├── 177-design-supabase-schema.md
│   ├── 178-fastapi-gateway.md
│   └── ...
├── sprints/             # Sprint summaries
│   ├── sprint-1.md
│   └── sprint-2.md
└── by-assignee/         # Grouped by assignee
    ├── justinedevs/
    ├── arhonjay/
    └── tristan-t-dev/
```

## Issue Markdown Files

Each issue is converted to a markdown file following this naming pattern:
`{issue-number}-{slugified-title}.md`

Example: `177-design-supabase-schema.md`

### File Structure

Each issue .md file contains:
- Issue metadata (status, assignee, sprint, milestone, labels)
- Original issue body
- Implementation notes section with:
  - Progress updates
  - Implementation decisions
  - Code changes
  - Testing checklist
  - PR links
  - Completion checklist

## Converting Issues

Use the conversion script to generate markdown files from GitHub issues:

```bash
# Convert all issues for an assignee
python scripts/github/convert_issues_to_markdown.py \
  --assignee JustineDevs \
  --output-dir docs/implementation/issues

# Convert issues for a specific sprint
python scripts/github/convert_issues_to_markdown.py \
  --assignee JustineDevs \
  --sprint "Sprint 1" \
  --output-dir docs/implementation/issues

# Convert a specific issue
python scripts/github/convert_issues_to_markdown.py \
  --issue 177 \
  --output-dir docs/implementation/issues

# Sync existing files with GitHub
python scripts/github/convert_issues_to_markdown.py \
  --assignee JustineDevs \
  --sync \
  --output-dir docs/implementation/issues
```

## Workflow

1. **Fetch Issues**: Use `fetch_my_issues.py` to get assigned issues
2. **Convert to Markdown**: Use `convert_issues_to_markdown.py` to create .md files
3. **Work on Issues**: Update .md files as you implement
4. **Track Progress**: Update progress checklists in .md files
5. **Commit**: Commit .md files with your implementation changes

## Best Practices

- Update progress checklists as you work
- Document implementation decisions
- Link PRs that close issues
- Keep files in sync with GitHub using `--sync` flag
- Commit .md files with related code changes

