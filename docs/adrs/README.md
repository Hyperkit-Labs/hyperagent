# Architecture Decision Records

ADRs record **significant** technical and product decisions: what was chosen, why, and trade-offs. They are not for every small change.

## Proposing an ADR

1. Copy [`0000-template.md`](./0000-template.md) to `docs/adrs/NNNN-short-kebab-title.md` with the next number (`0004-...`, and so on).
2. Fill **Context**, **Decision**, and **Consequences**. Link issues or PRs.
3. Open a PR. Mark **Status** as `Proposed` until maintainers accept it.
4. Update this index table and, if needed, [MkDocs nav](../introduction/documentation-site.md) in `mkdocs.yml`.

## Index

| ADR | Title | Status |
|-----|--------|--------|
| [0001-mandatory-honesty-artifact-maturity.md](./0001-mandatory-honesty-artifact-maturity.md) | Honesty policy, artifact maturity, sandbox lifecycle (full system design) | Accepted |
| [0002-api-schema-governance.md](./0002-api-schema-governance.md) | API versioning, schema registry, CI compatibility checks | Accepted |
| [0003-workflow-state-oss.md](./0003-workflow-state-oss.md) | XState UI mirror, LangGraph authority, Redis queue, idempotency | Accepted |
