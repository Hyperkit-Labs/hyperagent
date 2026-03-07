# /commit

Safe commit workflow (dry-run first) using the repo’s commit automation.

## Preferred workflow
1) Preview what will be committed:

```bash
npm run commit:dry
```

2) If output looks correct, commit with automation:

```bash
npm run commit
```

## Security guardrails (important)
The commit scripts block sensitive files by default:
- `.env` (except `.env.example`, `.env.template`, `.env.sample`)
- credentials / keys / certs

If a commit is blocked:
1) Run the security check to see why:

```bash
npm run security:check
```

2) Remove sensitive files from staging:

```bash
git reset HEAD .env
```

See: `.github/version/scripts/commit/COMMIT_GUIDE.md`
