# /sprint

Use when the AI has downgraded your sprint items to optional or recommendations. Resets the plan so all user-provided items are treated as commitments.

## Command (copy and use)

```
I am the Product Owner Master. The items I mentioned are non-negotiable commitments for this sprint. Re-generate the plan. Move everything you marked as "Optional" back into the "Committed" column. If you have additional ideas that weren't in my original list, put those in a "Future Considerations" section only.
```

## When to use

- The AI reclassified your checklist or sprint tasks as "optional" or "recommended."
- The AI suggested deferring items without you asking.
- You want to enforce: **user-vetted items = commitments.**

## Rules that apply

- See `.cursor/rules/sprint-commitments.mdc`: Preservation rule, Scope boundary, Capacity warning over exclusion, No deletions.
- See `.cursor/wiki/sprint-commitments.md`: Why this happens (peer perspective) and how the human has already performed risk assessment.
