# Runbooks

Operational playbooks for **deployments**, **incidents**, and **recovery**. Technical deep dives for agents and permissions remain under [agent operating model](../agent-operating-model/README.md).

| Runbook | When to use |
|---------|----------------|
| [Deployment runbook](deployment-runbook.md) | Shipping or refreshing environments, coordination between Studio, API, and orchestrator |
| [Recovery runbook](../agent-operating-model/recovery-runbook.md) | Stale state, retries, reconnects, stop conditions in agent workflows |

## Contributing runbooks

1. Use Markdown in `docs/runbooks/`.
2. Link to architecture and ADRs instead of duplicating policy.
3. Prefer **diagrams as code** (Mermaid) in `docs/architecture/` or inline in the runbook.
