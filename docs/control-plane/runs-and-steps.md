# Control plane: runs and steps

Phase 1 tracks pipeline execution with a relational control plane: runs, per-step rows, and optional checkpoints for resume.

## Concepts

| Concept | Role |
|---------|------|
| Run | A workflow execution with stable identifiers |
| Step | A pipeline stage instance with status and errors |
| `run_steps` | Durable rows; update in place rather than deleting history |
| Checkpoint | LangGraph state in **Redis** for resume |

## Append-only style

Insert when a step starts; update the same row for completion. Avoid deleting completed rows. Agent logs are insert-only where implemented.

## Related docs

- [Workflow state management](workflow-state-management.md)
- [Storage policy](storage-policy.md)
