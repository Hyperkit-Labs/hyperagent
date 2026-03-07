# /issues

GitHub issue operator workflow (list → validate → normalize).

All scripts require `GITHUB_TOKEN` (or `GH_TOKEN`) in the project root `.env`.

## List issues
Basic:

```bash
npm run issues:list
```

Filter by label:

```bash
npm run issues:list -- --label "area:frontend" --limit 20
```

Filter by assignee (recommended for your workflow):

```bash
npm run issues:list -- --assignee "JustineDevs"
```

## Phase filtering (recommended convention)
Use labels like:
- `phase:1`
- `phase:2`
- `phase:3`

Then list them:

```bash
npm run issues:list -- --label "phase:1" --assignee "JustineDevs"
```

## Validate issues against template

```bash
npm run issues:validate
```

## Normalize / bulk update issue bodies (doc refs, sections)
Preview first:

```bash
npm run issues:bulk-update:dry
```

Apply:

```bash
npm run issues:bulk-update
```

Config file:
- `scripts/issue-transforms.json`
