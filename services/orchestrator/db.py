"""
Supabase persistence for runs, deployments, simulations, security_findings.
Uses service role key; RLS still applies to user reads via anon key.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any

logger = logging.getLogger(__name__)

_supabase = None


def _client():
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            return None
        from supabase import create_client
        _supabase = create_client(url, key)
    return _supabase


def is_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_KEY"))


def _is_uuid(s: str) -> bool:
    if not s or not isinstance(s, str):
        return False
    try:
        uuid.UUID(s)
        return True
    except ValueError:
        return False


def is_uuid(s: str) -> bool:
    """Public helper for UUID validation."""
    return _is_uuid(s)


def ensure_user_profile(user_id: str, wallet_address: str | None = None, display_name: str | None = None) -> bool:
    """Ensure user_profiles row exists for auth user. No-op for SIWE (wallet_users)."""
    if not _is_uuid(user_id):
        return False
    client = _client()
    if not client:
        return False
    try:
        payload = {"id": user_id}
        if wallet_address is not None:
            payload["wallet_address"] = wallet_address
        if display_name is not None:
            payload["display_name"] = display_name
        client.table("user_profiles").upsert(payload, on_conflict="id").execute()
        return True
    except Exception as e:
        logger.warning("[db] ensure_user_profile failed: %s", e)
        return False


def ensure_project(project_id: str, user_id: str) -> bool:
    """Ensure project exists (for run FK). Uses project_id and user_id.
    When SIWE: user_id is wallet_users.id; upsert sets wallet_user_id and user_id=null (or SUPABASE_SYSTEM_USER_ID).
    When auth: user_id is auth.users.id; upsert sets user_id. Requires projects_wallet_owner migration for SIWE."""
    if not _is_uuid(project_id) or not _is_uuid(user_id):
        return False
    client = _client()
    if not client:
        return False
    payload_base = {"id": project_id, "name": "Default", "description": "", "status": "draft"}
    system_user = os.environ.get("SUPABASE_SYSTEM_USER_ID", "").strip() or None
    if system_user and _is_uuid(system_user):
        payload_base["user_id"] = system_user
        payload_base["wallet_user_id"] = user_id
    else:
        payload_base["wallet_user_id"] = user_id
        payload_base["user_id"] = None
    try:
        client.table("projects").upsert(payload_base, on_conflict="id").execute()
        return True
    except Exception as e:
        logger.warning("[db] ensure_project failed: %s", e)
        try:
            fallback = {"id": project_id, "user_id": user_id, "name": "Default", "description": "", "status": "draft"}
            client.table("projects").upsert(fallback, on_conflict="id").execute()
            return True
        except Exception as e:
            logger.warning("[db] ensure_project failed: %s", e)
            return False


def insert_run(
    run_id: str,
    project_id: str,
    trigger: str = "manual",
    status: str = "running",
    workflow_version: str = "0.1.0",
) -> dict[str, Any] | None:
    """Insert a run. project_id must exist in projects. Returns row or None if not configured."""
    client = _client()
    if not client:
        return None
    try:
        r = client.table("runs").insert({
            "id": run_id,
            "project_id": project_id,
            "trigger": trigger,
            "status": status,
            "current_stage": "spec",
            "workflow_version": workflow_version,
        }).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_run failed: %s", e)
        return None


def update_run(
    run_id: str,
    status: str | None = None,
    current_stage: str | None = None,
    error_message: str | None = None,
    stages: list | None = None,
) -> bool:
    """Update run status/stage. Returns True if updated."""
    client = _client()
    if not client:
        return False
    payload = {}
    if status is not None:
        payload["status"] = status
    if current_stage is not None:
        payload["current_stage"] = current_stage
    if error_message is not None:
        payload["error_message"] = error_message
    if stages is not None:
        payload["stages"] = stages
    if not payload:
        return True
    try:
        client.table("runs").update(payload).eq("id", run_id).execute()
        return True
    except Exception as e:
        logger.warning("[db] update_run failed: %s", e)
        return False


def insert_deployment(
    run_id: str,
    project_id: str,
    chain_id: int,
    contract_name: str,
    plan: dict[str, Any],
    network_name: str = "",
    deployment_order: int = 0,
) -> dict[str, Any] | None:
    """Insert a pending deployment (plan). Returns row with id or None.
    deployment_order: for multi-contract, lower values deploy first (0, 1, 2...)."""
    client = _client()
    if not client:
        return None
    try:
        row = {
            "run_id": run_id,
            "project_id": project_id,
            "chain_id": chain_id,
            "network_name": network_name or str(chain_id),
            "contract_name": contract_name,
            "plan": plan,
            "status": "pending",
            "deployment_order": deployment_order,
        }
        r = client.table("deployments").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_deployment failed: %s", e)
        return None


def insert_simulation(
    run_id: str,
    network: str,
    from_address: str,
    success: bool,
    gas_used: int | None = None,
    error_message: str | None = None,
    raw_result: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Insert a simulation result. Returns row or None."""
    client = _client()
    if not client:
        return None
    try:
        row = {
            "run_id": run_id,
            "network": network,
            "from_address": from_address,
            "to_address": None,
            "data": None,
            "value": "0",
            "success": success,
            "gas_used": gas_used,
            "error_message": error_message,
        }
        if raw_result:
            row["traces"] = raw_result.get("traces")
            row["state_diffs"] = raw_result.get("state_diffs")
        r = client.table("simulations").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] unknown failed: %s", e)
        return None


def insert_security_finding(
    run_id: str,
    tool: str,
    severity: str,
    title: str,
    description: str | None = None,
    location: str | None = None,
    category: str | None = None,
    artifact_id: str | None = None,
) -> dict[str, Any] | None:
    """Insert a security finding. Returns row or None. Links to project_artifacts when artifact_id provided."""
    client = _client()
    if not client:
        return None
    try:
        row = {
            "run_id": run_id,
            "tool": tool,
            "severity": severity,
            "title": title,
            "description": description or "",
            "location": location,
            "category": category,
        }
        if artifact_id and _is_uuid(artifact_id):
            row["artifact_id"] = artifact_id
        r = client.table("security_findings").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_security_finding failed: %s", e)
        return None


def insert_project_artifact(
    project_id: str,
    run_id: str | None,
    artifact_type: str,
    name: str,
    content: str | None = None,
    ipfs_cid: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str | None:
    """Insert a project_artifacts row. Returns artifact id or None.
    artifact_type: spec, design_doc, contract, audit_report, simulation_report, deployment_record."""
    client = _client()
    if not client or not _is_uuid(project_id):
        return None
    try:
        row = {
            "project_id": project_id,
            "run_id": run_id if _is_uuid(run_id or "") else None,
            "type": artifact_type,
            "name": name,
            "content": (content[:65535] if content and len(content) > 65535 else content) if content else None,
            "ipfs_cid": ipfs_cid,
            "metadata": metadata or {},
        }
        r = client.table("project_artifacts").insert(row).execute()
        return str(r.data[0]["id"]) if r.data else None
    except Exception as e:
        logger.warning("[db] insert_project_artifact failed: %s", e)
        return None


def insert_agent_log(
    run_id: str,
    agent_name: str,
    stage: str,
    message: str,
    log_level: str = "info",
    metadata: dict[str, Any] | None = None,
) -> bool:
    """Insert a row into agent_logs. Used by pipeline steps. Returns True if inserted."""
    client = _client()
    if not client or not run_id or not agent_name or not stage or not message:
        return False
    if log_level not in ("debug", "info", "warning", "error"):
        log_level = "info"
    try:
        client.table("agent_logs").insert({
            "run_id": run_id,
            "agent_name": agent_name,
            "stage": stage,
            "message": message[:4096] if len(message) > 4096 else message,
            "log_level": log_level,
            "metadata": metadata or {},
        }).execute()
        return True
    except Exception as e:
        logger.warning("[db] insert_agent_log failed: %s", e)
        return False


def insert_step(
    run_id: str,
    step_index: int,
    step_type: str,
    status: str = "running",
    input_summary: str | None = None,
    started_at: str | None = None,
) -> dict[str, Any] | None:
    """Insert or upsert a run step (status running). No-op if Supabase not configured."""
    client = _client()
    if not client:
        return None
    try:
        from datetime import UTC, datetime
        row = {
            "run_id": run_id,
            "step_index": step_index,
            "step_type": step_type,
            "status": status,
            "started_at": started_at or datetime.now(UTC).isoformat(),
        }
        if input_summary is not None:
            row["input_summary"] = input_summary[:4096] if len(input_summary or "") > 4096 else input_summary
        r = client.table("run_steps").upsert(row, on_conflict="run_id,step_type").execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_step failed: %s", e)
        return None


def update_step(
    run_id: str,
    step_type: str,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    completed_at: str | None = None,
    trace_blob_id: str | None = None,
    trace_da_cert: str | None = None,
    trace_reference_block: str | None = None,
) -> bool:
    """Update a run step to completed or failed. Optional trace fields for run_steps trace storage."""
    client = _client()
    if not client:
        return False
    try:
        from datetime import UTC, datetime
        payload = {"status": status}
        if output_summary is not None:
            payload["output_summary"] = output_summary[:4096] if len(output_summary) > 4096 else output_summary
        if error_message is not None:
            payload["error_message"] = error_message[:2048] if len(error_message) > 2048 else error_message
        payload["completed_at"] = completed_at or datetime.now(UTC).isoformat()
        if trace_blob_id is not None:
            payload["trace_blob_id"] = trace_blob_id
        if trace_da_cert is not None:
            payload["trace_da_cert"] = trace_da_cert
        if trace_reference_block is not None:
            payload["trace_reference_block"] = trace_reference_block
        client.table("run_steps").update(payload).eq("run_id", run_id).eq("step_type", step_type).execute()
        return True
    except Exception as e:
        logger.warning("[db] unknown failed: %s", e)
        return False


def get_steps(run_id: str) -> list[dict[str, Any]]:
    """Return steps for a run, ordered by step_index. Empty list if Supabase not configured."""
    client = _client()
    if not client:
        return []
    try:
        r = client.table("run_steps").select("*").eq("run_id", run_id).order("step_index").execute()
        return list(r.data) if r.data else []
    except Exception as e:
        logger.warning("[db] get_steps failed: %s", e)
        return []


def _to_ts(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, str):
        return val
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def _run_steps_to_log_entries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for row in rows:
        ts = _to_ts(row.get("completed_at") or row.get("started_at") or row.get("created_at"))
        msg = row.get("output_summary") or row.get("error_message") or row.get("status") or ""
        step = row.get("step_type") or ""
        if step and msg:
            msg = f"[{step}] {msg}"
        elif step:
            msg = f"[{step}] {row.get('status', '')}"
        level = "error" if row.get("status") == "failed" else "info"
        out.append({"message": msg[:2048] if msg else "-", "level": level, "timestamp": ts, "service": step or "orchestrator"})
    return out


def _agent_logs_to_log_entries(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for row in rows:
        ts = _to_ts(row.get("created_at"))
        msg = row.get("message") or ""
        agent = row.get("agent_name") or ""
        level = (row.get("log_level") or "info").lower()
        if agent and msg:
            msg = f"[{agent}] {msg}"
        elif agent:
            msg = f"[{agent}] {row.get('stage', '')}"
        out.append({"message": msg[:2048] if msg else "-", "level": level, "timestamp": ts, "service": agent or "agent"})
    return out


def get_workflow_state(run_id: str) -> dict[str, Any] | None:
    """Return workflow state json for run_id from runs.workflow_state. None if not configured or missing."""
    client = _client()
    if not client:
        return None
    try:
        r = client.table("runs").select("workflow_state").eq("id", run_id).execute()
        row = (r.data or [{}])[0] if r.data else {}
        state = row.get("workflow_state")
        return state if isinstance(state, dict) else None
    except Exception as e:
        logger.warning("[db] get_workflow_state failed: %s", e)
        return None


def upsert_workflow_state(run_id: str, state: dict[str, Any]) -> bool:
    """Persist workflow state to runs.workflow_state. Returns True if updated."""
    client = _client()
    if not client:
        return False
    try:
        client.table("runs").update({"workflow_state": state}).eq("id", run_id).execute()
        return True
    except Exception as e:
        logger.warning("[db] upsert_workflow_state failed: %s", e)
        return False


def _store_status_to_run_status(store_status: str) -> str:
    """Map store status (building/completed/failed) to runs.status (running/success/failed)."""
    if not store_status:
        return ""
    s = (store_status or "").lower()
    if s in ("completed", "success"):
        return "success"
    if s in ("failed", "cancelled"):
        return s
    if s in ("building", "running"):
        return "running"
    return "running"


def list_workflow_states(limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    """List runs with workflow_state, newest first. status filters runs.status (store status mapped to run status)."""
    client = _client()
    if not client:
        return []
    try:
        run_status = _store_status_to_run_status(status) if status else None
        q = client.table("runs").select("id, workflow_state, status, created_at").order("created_at", desc=True).limit(min(limit, 100))
        if run_status:
            q = q.eq("status", run_status)
        r = q.execute()
        rows = list(r.data) if r.data else []
        out = []
        for row in rows:
            state = row.get("workflow_state")
            if isinstance(state, dict):
                state = dict(state)
                state["workflow_id"] = str(row.get("id", ""))
                state["run_id"] = str(row.get("id", ""))
                out.append(state)
            elif row.get("id"):
                out.append({"workflow_id": str(row["id"]), "run_id": str(row["id"]), "status": row.get("status"), "created_at": row.get("created_at")})
        return out
    except Exception as e:
        logger.warning("[db] list_workflow_states failed: %s", e)
        return []


def count_runs() -> int:
    """Total run count for metrics."""
    client = _client()
    if not client:
        return 0
    try:
        r = client.table("runs").select("id", count="exact").execute()
        return int(getattr(r, "count", 0) or 0)
    except Exception as e:
        logger.warning("[db] count_runs failed: %s", e)
        return 0


def get_recent_activity_logs(limit: int = 50) -> list[dict[str, Any]]:
    """Return recent activity from run_steps and agent_logs for GET /api/v1/logs. Empty list if not configured or on error."""
    client = _client()
    if not client:
        return []
    try:
        entries = []
        r = (
            client.table("run_steps")
            .select("run_id, step_type, status, output_summary, error_message, started_at, completed_at, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = list(r.data) if r.data else []
        entries.extend(_run_steps_to_log_entries(rows))
        try:
            r2 = (
                client.table("agent_logs")
                .select("agent_name, stage, log_level, message, created_at")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            rows2 = list(r2.data) if r2.data else []
            entries.extend(_agent_logs_to_log_entries(rows2))
        except Exception as e:
            logger.warning("[db] get_recent_activity_logs failed: %s", e)
            pass
        entries.sort(key=lambda e: (e.get("timestamp") or ""), reverse=True)
        return entries[:limit]
    except Exception as e:
        logger.warning("[db] unknown failed: %s", e)
        return []
