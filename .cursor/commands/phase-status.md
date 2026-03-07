# /phase-status

Phase 1–3 progress snapshot (lightweight, low-token workflow).

## Recommended conventions
- Use labels: `phase:foundation`, `phase:2`, `phase:3`
- Keep ownership labels too (e.g. `area:frontend`, `area:agents`)
- Keep issues assigned to the current owner (e.g. `JustineDevs`)

## Daily snapshot commands
Phase 1:

```bash
npm run issues:list -- --label "phase:foundation" --assignee "JustineDevs"
```

Phase 2:

```bash
npm run issues:list -- --label "phase:2" --assignee "JustineDevs"
```

Phase 3:

```bash
npm run issues:list -- --label "phase:3" --assignee "JustineDevs"
```

## Hygiene gates (run before you implement a batch)
1) Validate issue bodies:

```bash
npm run issues:validate -- --limit 20
```

2) Normalize doc references (dry-run first):

```bash
npm run issues:bulk-update:dry -- --limit 20
```

## Batch rule (keeps progress steady)
- Pick the next **3** open issues from the current Phase.
- Plan them together, implement together, then update your rolling PR.
