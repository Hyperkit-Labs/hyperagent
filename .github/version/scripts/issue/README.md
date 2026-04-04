# Issue Scripts

Template-aware GitHub issue tools. All require `GITHUB_TOKEN` in `.env`.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **bulk-update** | `npm run issues:bulk-update` | Update issues with doc refs, template transforms |
| **bulk-update:dry** | `npm run issues:bulk-update:dry` | Preview changes without updating |
| **generate** | `npm run issues:generate -- -t "Title"` | Generate issue body from template |
| **validate** | `npm run issues:validate` | Validate issues against template |
| **list** | `npm run issues:list` | List issues with filters |

## Usage

### Bulk Update
```bash
npm run issues:bulk-update:dry   # Preview
npm run issues:bulk-update      # Apply
```

### Generate
```bash
# Output to stdout
npm run issues:generate -- -t "Add login flow"

# With area and type
npm run issues:generate -- -t "Fix API timeout" -a frontend -y bug

# Write to file
npm run issues:generate -- -t "Implement X" -o new-issue.md
```

### Validate
```bash
npm run issues:validate
npm run issues:validate -- --limit 10
```

### List
```bash
npm run issues:list
npm run issues:list -- --state closed
npm run issues:list -- --label "area:frontend" --limit 20
npm run issues:list -- --assignee "JustineDevs" --limit 20
```

## Config

- `scripts/issue-transforms.json` – doc replacements, labels
