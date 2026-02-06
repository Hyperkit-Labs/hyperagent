# Code Owners Assignment Logic

The issue creation script automatically assigns issues to owners based on the CODEOWNERS file and issue area/type.

## Owners

From `CODEOWNERS`:
- **@JustineDevs** - CPOO/Product Lead (Primary AI Augmented Builder and Reviewer, acts as CTO too)
- **@ArhonJay** - CTO/Project Architect
- **@Tristan-T-Dev** - Frontend Developer / UI/UX

## Assignment Rules

### @Tristan-T-Dev (Frontend Developer)
Assigned to issues in these areas:
- **frontend** - UI/UX, Frontend development, React/Next.js

### @JustineDevs (CPOO/Product Lead)
Assigned to issues in these areas:
- **orchestration** - Product operations, workflow management
- **epic** - All epics (primary owner)
- **Default** - Unassigned areas default to JustineDevs

### @ArhonJay (CTO/Project Architect)
Assigned to issues in these areas:
- **agents** - Technical agent implementation
- **chain-adapter** - Smart contracts, deployment, chain integration
- **contracts** - Solidity contract development
- **infra** - Infrastructure, DevOps, CI/CD
- **storage-rag** - Technical data systems, vector DBs
- **security** - Security architecture, auditing
- **observability** - Technical monitoring, metrics
- **sdk-cli** - Technical SDK development

## Review Assignment

Issues are cross-reviewed:
- Issues assigned to **@Tristan-T-Dev** → Reviewed by **@JustineDevs** (product lead)
- Issues assigned to **@JustineDevs** → Reviewed by **@ArhonJay**
- Issues assigned to **@ArhonJay** → Reviewed by **@JustineDevs**

## How It Works

1. Script reads `CODEOWNERS` file from repository root
2. Parses owner usernames and roles
3. Determines assignee based on issue `area` and `type` labels
4. Sets owner in issue body and GitHub assignee field
5. Sets reviewer as the opposite owner

## Example Assignments

| Issue Area | Issue Type | Assigned To | Reviewer |
|------------|------------|-------------|----------|
| frontend | feature | @Tristan-T-Dev | @JustineDevs |
| agents | feature | @ArhonJay | @JustineDevs |
| orchestration | epic | @JustineDevs | @ArhonJay |
| chain-adapter | feature | @ArhonJay | @JustineDevs |
| contracts | feature | @ArhonJay | @JustineDevs |
| infra | chore | @ArhonJay | @JustineDevs |

## Customization

To modify assignment rules, edit the `_assign_owner()` method in `scripts/github/create_phase1_issues.py`:

```python
def _assign_owner(self, area: Optional[str], issue_type: str) -> str:
    # Modify justine_areas and arhon_areas sets
    # to change assignment logic
```

