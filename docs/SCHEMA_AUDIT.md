# Schema Audit: Application vs Database Tables

This document maps each schema table to code usage, identifies gaps (stubbed, unused, not connected), and provides remediation.

## Table Summary

| Table | Used | Write | Read | Status |
|-------|------|-------|------|--------|
| agent_context | Yes | Yes | Yes | Context service; user_id FK to auth.users |
| agent_logs | Partial | **No** | Yes | **Gap: never written** |
| credit_transactions | Yes | Yes | Yes | credits_supabase |
| deployments | Yes | Yes | Yes | db.py |
| payment_history | Yes | Yes | Yes | payments_supabase |
| project_artifacts | **No** | **No** | **No** | **Gap: not wired** |
| projects | Yes | Yes | Yes | db.py |
| run_steps | Yes | Yes | Yes | **Schema mismatch: step_type** |
| runs | Yes | Yes | Yes | db.py |
| security_findings | Yes | Yes | Yes | db.py |
| simulations | Yes | Yes | Yes | db.py |
| spending_controls | Yes | Yes | Yes | payments_supabase |
| storage_records | Yes | Yes | No | ipfs_client; artifact_id always null |
| user_api_keys | No | No | No | **Gap: not wired (auth layer)** |
| user_credits | Yes | Yes | Yes | credits_supabase |
| user_profiles | No | No | No | **Gap: not wired (frontend)** |
| wallet_users | Yes | Yes | Yes | llm_keys_supabase, credits, payments |

---

## Detailed Findings

### 1. agent_context

- **Schema**: `user_id` FK to `auth.users(id)`; `context_type` in (conversation, learning, template, pattern)
- **Code**: `services/context/main.py` inserts and selects
- **Status**: Wired. Note: SIWE-only users (no auth.users row) will fail FK; need wallet_users→auth mapping if supporting SIWE context.

### 2. agent_logs

- **Schema**: `run_id` FK to runs; `agent_name`, `stage`, `log_level`, `message`
- **Code**: `db.py` reads in `get_recent_activity_logs`; **no insert anywhere**
- **Status**: **Gap**. Table is read but never populated. Orchestrator should insert on each pipeline step start/complete.

### 3. credit_transactions

- **Schema**: `user_id` FK to `wallet_users(id)`; `type` in (top_up, consume, refund, adjustment)
- **Code**: `credits_supabase.py` via RPC `top_up_credits`, `consume_credits`
- **Status**: Wired. X-User-Id must be wallet_users.id.

### 4. deployments

- **Schema**: `project_id`, `run_id` FKs; `status` in (pending, client-deployed, deployed)
- **Code**: `db.insert_deployment`, `db.update_run`; main.py deploy flow
- **Status**: Wired.

### 5. payment_history

- **Schema**: `user_id` FK to `wallet_users(id)`
- **Code**: `payments_supabase.get_payment_history`, `get_payment_summary`
- **Status**: Wired.

### 6. project_artifacts

- **Schema**: `project_id`, `run_id` FKs; `type` in (contract, test, abi, audit_report, simulation_report, deployment_record, design_doc)
- **Code**: **Not used**. No insert or select.
- **Status**: **Gap**. Intended for pipeline artifacts (spec, design, code, audit, etc.). Currently ipfs_client writes only to storage_records with run_id; no project_artifacts row.

### 7. projects

- **Schema**: `user_id` (auth.users), `wallet_user_id` (wallet_users)
- **Code**: `db.ensure_project`, `db.insert_run`
- **Status**: Wired. Uses wallet_user_id when SUPABASE_SYSTEM_USER_ID set (SIWE).

### 8. run_steps

- **Schema**: `step_type` check: spec, design, codegen, audit, simulation, deploy, ui_scaffold
- **Code**: `nodes.py` uses **scrubd, debate, exploit_sim, guardian** (not in schema)
- **Status**: **Schema mismatch**. Pipeline will fail INSERT for scrubd/debate/exploit_sim/guardian due to check constraint.

### 9. runs

- **Schema**: `project_id` FK; `status`, `trigger` checks
- **Code**: `db.insert_run`, `update_run`, `upsert_workflow_state`
- **Status**: Wired.

### 10. security_findings

- **Schema**: `run_id` FK; `artifact_id` FK to project_artifacts (nullable)
- **Code**: `db.insert_security_finding` (artifact_id not passed, stays null)
- **Status**: Wired. artifact_id optional.

### 11. simulations

- **Schema**: `run_id` FK
- **Code**: `db.insert_simulation`
- **Status**: Wired.

### 12. spending_controls

- **Schema**: `user_id` FK to wallet_users; `period` in (daily, weekly, monthly)
- **Code**: `payments_supabase.get_spending_control`, `update_spending_control`
- **Status**: Wired.

### 13. storage_records

- **Schema**: `artifact_id` FK to project_artifacts (nullable); `run_id` FK
- **Code**: `ipfs_client.record_storage` inserts with run_id, cid, storage_type, status; artifact_id not set
- **Status**: Wired. artifact_id always null; run_id used for pipeline stage pins.

### 14. user_api_keys

- **Schema**: `user_id` FK to auth.users
- **Code**: Not used in orchestrator
- **Status**: **Gap**. Intended for API key auth; separate auth layer.

### 15. user_credits

- **Schema**: `user_id` FK to wallet_users
- **Code**: `credits_supabase.get_balance`, `top_up`, `consume`
- **Status**: Wired.

### 16. user_profiles

- **Schema**: `id` FK to auth.users
- **Code**: Not used in orchestrator
- **Status**: **Gap**. Frontend/profile service.

### 17. wallet_users

- **Schema**: No FKs
- **Code**: `llm_keys_supabase` (encrypted_llm_keys); credits/payments use wallet_users.id as user_id
- **Status**: Wired.

---

## Remediation

### High priority

1. **run_steps step_type**: Add scrubd, debate, exploit_sim, guardian to schema check (migration).
2. **agent_logs**: Insert rows in orchestrator when each pipeline step starts/completes.

### Medium priority

3. **project_artifacts**: Wire pipeline to create project_artifacts for spec, design, code, audit, simulation; link storage_records.artifact_id when pinning.

### Low priority

4. **user_profiles**, **user_api_keys**: Frontend/auth layer; document as out-of-scope for orchestrator.

---

## Full-Lifecycle Stress Test Coverage

The stress test should exercise:

- **Write paths**: workflow create (projects, runs, run_steps), credits top-up (user_credits, credit_transactions), spending control (spending_controls), payments (payment_history when x402 used), deployments, simulations, security_findings, storage_records
- **Read paths**: logs (run_steps, agent_logs), workflows, credits, payments, deployments
- **Context service**: agent_context (if context service deployed)
- **Validation**: FK integrity (wallet_users.id for credits/payments), step_type values, status enums
