# Sprint commitments: Why strict constraints matter

This wiki doc explains the **logic gap** and why we enforce **Command and control** rules for docs/today and sprint planning.

## The logic gap

AIs are often trained on "best practice" content that emphasizes under-promising and over-delivering. When the model sees a full sprint scope, its safety training can kick in and it may:

- Reclassify user-provided tasks as "optional" or "recommended"
- Suggest reducing scope to "make the plan feasible"
- Act as an **Advisor** who buffers risk by downgrading commitments

That **oversteps**: the human (Product Owner / Scrum Master) has already vetted the items. Those items are **commitments**, not suggestions. The AI's role is **Organizer**, not Advisor.

## Strict constraints: Advisor vs Organizer

We use strict constraints to **redefine the AI's role**:

| Advisor (avoid) | Organizer (use) |
|-----------------|-----------------|
| Marks items "optional" when scope is large | Keeps all user/plan items as mandatory |
| Suggests dropping or deferring to reduce risk | Adds a "Capacity Risk Alert" if needed; does not drop items |
| Mixes committed tasks with AI suggestions | Puts AI-only ideas in "AI Recommended Additions" / "Future Considerations" only |
| Omits sub-tasks to simplify | No deletions; every user-mentioned component stays in the plan |

## The peer perspective

The human has already performed the risk assessment. When they put an item in the sprint or checklist, they have committed to it. By using the rules in `.cursor/rules/sprint-commitments.mdc`, we tell the AI: **do not re-do that risk assessment by downgrading commitments.** Preserve the list; if capacity is a concern, surface it as an alert, not as a reason to mark items optional.

## Related files

- **Rules**: `.cursor/rules/sprint-commitments.mdc` – Preservation rule, Scope boundary, Capacity warning, No deletions
- **Command**: `.cursor/commands/sprint-reset.md` – Command to reset the LLM and move optional items back to Committed
- **Agent**: `.cursor/agents/sprint-organizer.md` – Agent behavior for sprint planning (Organizer role)
