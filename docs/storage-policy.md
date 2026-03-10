# Storage policy: traces, artifacts, indexes

Single policy for where data lives so traces, artifacts, and indexes stay consistent.

---

## Rule

- **Traces** – Stub blob IDs stored in Supabase (`run_steps.trace_blob_id`). In production, IPFS (Pinata) is required for verifiable provenance; stub mode logs runs as unverifiable.
- **Artifacts (files, IPFS)** – IPFS (e.g. Pinata). CID and gateway URL stored in Supabase or returned in API.
- **Indexes and relational data** – Supabase (Postgres). Projects, runs, run_steps, deployments, simulations, user_profiles, etc.

## Production

- Configure `PINATA_API_KEY` and `PINATA_JWT` (or equivalent) so trace writer pins to IPFS. Without IPFS, traces use stub IDs and runs are marked unverifiable in logs.

---

## Where blob_id and cid are stored

| Data | Storage | ID stored |
|------|---------|-----------|
| Pipeline step trace (AgentTraceBlob) | Stub (in-process) | `run_steps.trace_blob_id` (and optional `trace_da_cert`, `trace_reference_block`) |
| Pinned JSON/artifacts | IPFS (Pinata) | Returned as `cid` and `gatewayUrl` in API; caller may persist in deployments or run metadata |
| Run and step metadata | Supabase | `runs`, `run_steps` (no large blobs in Postgres) |
| Deployment plans | Supabase | `deployments.plan` (JSON); large binaries stay in IPFS or external storage |

---

## Do not

- Store large blobs (raw trace payloads, full artifact bodies) in Postgres. Store only references (blob_id, cid).
- Duplicate the same artifact in both IPFS and Postgres; store once in IPFS and reference by cid.
- Emit traces without storing the returned blob_id in `run_steps` so runs can be correlated.

---

## References

- Trace writer: `services/orchestrator/trace_writer.py`; migration `006_run_steps_trace.sql` (if present).
- IPFS/Pinata: `packages/web3-utils` (IpfsPinataToolkit), `services/storage`.
- Run steps and runs: `platform/supabase/migrations/run.sql`, [control-plane-runs-steps.md](control-plane-runs-steps.md).
