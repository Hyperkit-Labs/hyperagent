# Storage and data availability policy

This document is the **source of truth** for what gets stored where, and how hashes and references behave.

## Principles

1. Traces and provenance use stable identifiers in `run_steps` and related metadata.
2. Large artifacts belong in object storage or IPFS (for example Pinata), not in hot application rows.
3. Indexes and user metadata live in **Supabase (PostgreSQL)** with **RLS** where applicable.
4. Prefer references (URLs, CIDs, `blob_id`) to external storage over large blobs in Postgres.

## Where things go

| Kind | Typical store |
|------|----------------|
| Run metadata | Supabase `runs` |
| Step audit | Supabase `run_steps` |
| Append logs | Supabase `agent_logs` or equivalent |
| Artifacts | IPFS / Pinata with CID on the run |

## Related docs

- [Control plane: runs and steps](control-plane-runs-steps.md)
- [Workflow state management](workflow-state-management.md)
- [Security policy](https://github.com/Hyperkit-Labs/hyperagent/blob/main/SECURITY.md)
