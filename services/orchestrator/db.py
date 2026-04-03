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
        key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get(
            "SUPABASE_SERVICE_ROLE_KEY"
        )
        if not url or not key:
            return None
        from supabase import create_client

        _supabase = create_client(url, key)
    return _supabase


def is_configured() -> bool:
    return bool(
        os.environ.get("SUPABASE_URL")
        and (
            os.environ.get("SUPABASE_SERVICE_KEY")
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )
    )


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


def ensure_user_profile(
    user_id: str, wallet_address: str | None = None, display_name: str | None = None
) -> bool:
    """Deprecated. Use wallet_users + wallet_user_profiles. Kept for backward compat; no-op."""
    logger.debug(
        "[db] ensure_user_profile deprecated; wallet_users is the only principal"
    )
    return True


def ensure_wallet_user_profile(
    wallet_user_id: str,
    display_name: str | None = None,
    preferences: dict | None = None,
) -> bool:
    """Idempotent upsert of wallet_user_profiles. Use after bootstrap for wallet-native principal."""
    if not _is_uuid(wallet_user_id):
        return False
    client = _client()
    if not client:
        return False
    try:
        payload: dict[str, Any] = {"wallet_user_id": wallet_user_id}
        if display_name is not None:
            payload["display_name"] = display_name
        if preferences is not None:
            payload["preferences"] = preferences
        client.table("wallet_user_profiles").upsert(
            payload, on_conflict="wallet_user_id"
        ).execute()
        return True
    except Exception as e:
        logger.warning("[db] ensure_wallet_user_profile failed: %s", e)
        return False


def ensure_project(project_id: str, user_id: str) -> bool:
    """Ensure project exists (for run FK). Uses project_id and user_id.
    When SIWE: user_id is wallet_users.id; upsert sets wallet_user_id and user_id=null (or SUPABASE_SYSTEM_USER_ID).
    When auth: user_id is auth.users.id; upsert sets user_id. Requires projects_wallet_owner migration for SIWE.
    """
    if not _is_uuid(project_id) or not _is_uuid(user_id):
        return False
    client = _client()
    if not client:
        return False
    payload_base = {
        "id": project_id,
        "name": "Default",
        "description": "",
        "status": "draft",
    }
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
            fallback = {
                "id": project_id,
                "wallet_user_id": user_id,
                "user_id": None,
                "name": "Default",
                "description": "",
                "status": "draft",
            }
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
        r = (
            client.table("runs")
            .insert(
                {
                    "id": run_id,
                    "project_id": project_id,
                    "trigger": trigger,
                    "status": status,
                    "current_stage": "spec",
                    "workflow_version": workflow_version,
                }
            )
            .execute()
        )
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
    wallet_user_id: str | None = None,
) -> dict[str, Any] | None:
    """Insert a pending deployment (plan). Returns row with id or None.
    deployment_order: for multi-contract, lower values deploy first (0, 1, 2...).
    wallet_user_id: owner identity for RLS; resolved from run→project→wallet_user_id if not provided.
    """
    client = _client()
    if not client:
        return None
    if not wallet_user_id:
        wallet_user_id = _resolve_wallet_user_id_for_project(project_id)
    try:
        row: dict[str, Any] = {
            "run_id": run_id,
            "project_id": project_id,
            "chain_id": chain_id,
            "network_name": network_name or str(chain_id),
            "contract_name": contract_name,
            "plan": plan,
            "status": "pending",
            "deployment_order": deployment_order,
        }
        if wallet_user_id:
            row["wallet_user_id"] = wallet_user_id
        r = client.table("deployments").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_deployment failed: %s", e)
        return None


def _resolve_wallet_user_id_for_project(project_id: str) -> str | None:
    """Look up wallet_user_id from the projects table for deployment ownership."""
    client = _client()
    if not client or not project_id:
        return None
    try:
        r = (
            client.table("projects")
            .select("wallet_user_id")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )
        if r.data and r.data[0].get("wallet_user_id"):
            return r.data[0]["wallet_user_id"]
    except Exception:
        pass
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


def insert_agent_registration(
    tx_hash: str,
    chain_id: int,
    agent_id: str,
    contract_address: str,
    source_route: str = "/api/v1/identity/register",
) -> dict[str, Any] | None:
    """Insert ERC-8004 registration proof. Returns row or None."""
    client = _client()
    if not client:
        return None
    try:
        row = {
            "tx_hash": tx_hash,
            "chain_id": chain_id,
            "agent_id": agent_id,
            "contract_address": contract_address,
            "source_route": source_route,
        }
        r = client.table("agent_registrations").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[db] insert_agent_registration failed: %s", e)
        return None


# Truncation limits (F-016). Content exceeding limits is cut; full content stored in IPFS when PINATA_* configured.
# Large artifacts: use storage_backend=ipfs and cid for full retrieval; inline content may be truncated.
# Filecoin: when FILECOIN_ARCHIVAL_ENABLED and LIGHTHOUSE_API_KEY, orchestrator registers CIDs via Lighthouse Filecoin First (see filecoin_client.py).
ARTIFACT_CONTENT_LIMIT = 65535  # project_artifacts.content, run_step outputs
AGENT_LOG_MESSAGE_LIMIT = 4096  # agent_log.message
OUTPUT_SUMMARY_LIMIT = 4096  # run_step.output_summary
ERROR_MESSAGE_LIMIT = 2048  # run_step.error_message, agent_log.message (when error)


def _truncate_and_warn(
    content: str | None,
    limit: int,
    field_name: str,
    run_id: str | None = None,
) -> tuple[str | None, bool]:
    """Truncate content at limit, log warning, return (truncated_content, was_truncated).
    Persist was_truncated in metadata so UI can show 'full report stored externally'."""
    if not content or len(content) <= limit:
        return (content, False)
    truncated = content[:limit]
    logger.warning(
        "[db] %s truncated to %d chars (limit=%d) run_id=%s",
        field_name,
        limit,
        limit,
        run_id or "n/a",
    )
    return (truncated, True)


def upsert_run_state(
    run_id: str,
    phase: str = "spec",
    status: str = "running",
    current_step: str | None = None,
    checkpoint_id: str | None = None,
    simulation_passed: bool = False,
    exploit_simulation_passed: bool = False,
) -> bool:
    """Upsert run_state row. Small delta; replaces full-blob workflow_state writes."""
    client = _client()
    if not client or not _is_uuid(run_id):
        return False
    try:
        from datetime import UTC, datetime

        payload = {
            "phase": phase,
            "status": status,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        if current_step is not None:
            payload["current_step"] = current_step
        if checkpoint_id is not None:
            payload["checkpoint_id"] = checkpoint_id
        payload["simulation_passed"] = simulation_passed
        payload["exploit_simulation_passed"] = exploit_simulation_passed
        client.table("run_state").upsert(
            {"run_id": run_id, **payload},
            on_conflict="run_id",
        ).execute()
        return True
    except Exception as e:
        # run_state table may not exist until migration 20260316000002 is applied
        logger.debug("[db] upsert_run_state failed (table may not exist): %s", e)
        return False


def get_run_state(run_id: str) -> dict[str, Any] | None:
    """Return run_state row as dict, or None if not configured or missing."""
    client = _client()
    if not client or not _is_uuid(run_id):
        return None
    try:
        r = client.table("run_state").select("*").eq("run_id", run_id).execute()
        row = (r.data or [{}])[0] if r.data else {}
        return row if isinstance(row, dict) and row.get("run_id") else None
    except Exception as e:
        # run_state table may not exist until migration 20260316000002 is applied
        logger.debug("[db] get_run_state failed (table may not exist): %s", e)
        return None


def upsert_workflow_artifacts(
    run_id: str,
    project_id: str,
    spec: dict | None = None,
    contracts: dict | None = None,
    deployments: list | None = None,
    audit_findings: list | None = None,
    ui_schema: dict | None = None,
    test_files: dict | None = None,
) -> None:
    """Write rich pipeline fields to project_artifacts (split from workflow_state blob).
    Each artifact type is stored separately; blob remains for backward compat."""
    if not _is_uuid(project_id) or not _is_uuid(run_id):
        return
    import json

    try:
        if spec:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="spec",
                name=f"spec-{run_id[:8]}.json",
                content=json.dumps(spec, default=str),
                metadata={"source": "workflow_state_split"},
            )
        if contracts:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="contracts",
                name=f"contracts-{run_id[:8]}.json",
                content=json.dumps(contracts, default=str),
                metadata={"source": "workflow_state_split"},
            )
        if deployments:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="deployment_record",
                name=f"deployments-{run_id[:8]}.json",
                content=json.dumps(deployments, default=str),
                metadata={"source": "workflow_state_split"},
            )
        if audit_findings:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="audit_report",
                name=f"audit-{run_id[:8]}.json",
                content=json.dumps(audit_findings, default=str),
                metadata={"source": "workflow_state_split"},
            )
        if ui_schema:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="ui_schema",
                name=f"ui_schema-{run_id[:8]}.json",
                content=json.dumps(ui_schema, default=str),
                metadata={"source": "workflow_state_split"},
            )
        if test_files:
            insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type="test_files",
                name=f"tests-{run_id[:8]}.json",
                content=json.dumps(test_files, default=str),
                metadata={"source": "workflow_state_split"},
            )
    except Exception as e:
        logger.warning("[db] upsert_workflow_artifacts failed: %s", e)


def insert_project_artifact(
    project_id: str,
    run_id: str | None,
    artifact_type: str,
    name: str,
    content: str | None = None,
    ipfs_cid: str | None = None,
    metadata: dict[str, Any] | None = None,
    storage_backend: str | None = None,
    cid: str | None = None,
    kind: str | None = None,
) -> str | None:
    """Insert a project_artifacts row. Returns artifact id or None.
    artifact_type/kind: spec, design, contracts, audit_report, sim_report, exploit_report, ui_schema.
    storage_backend: ipfs | inline. cid: IPFS CID when storage_backend=ipfs.
    Uses _truncate_and_warn for content; persists was_truncated in metadata.
    """
    client = _client()
    if not client or not _is_uuid(project_id):
        return None
    try:
        effective_content = content
        meta = dict(metadata or {})
        if content:
            truncated, was_truncated = _truncate_and_warn(
                content, ARTIFACT_CONTENT_LIMIT, "artifact content", run_id
            )
            effective_content = truncated
            if was_truncated:
                meta["was_truncated"] = True
                meta["truncated_at"] = ARTIFACT_CONTENT_LIMIT
        row = {
            "project_id": project_id,
            "run_id": run_id if _is_uuid(run_id or "") else None,
            "artifact_type": kind or artifact_type,
            "name": name,
            "content": effective_content,
            "ipfs_cid": cid or ipfs_cid,
            "metadata": meta,
        }
        if storage_backend:
            row["storage_backend"] = storage_backend
        if cid:
            row["cid"] = cid
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
        truncated_msg, was_truncated = _truncate_and_warn(
            message, AGENT_LOG_MESSAGE_LIMIT, "agent_log message", run_id
        )
        effective_msg = truncated_msg or message
        client.table("agent_logs").insert(
            {
                "run_id": run_id,
                "agent_name": agent_name,
                "stage": stage,
                "message": effective_msg,
                "log_level": log_level,
                "metadata": (
                    {**(metadata or {}), "was_truncated": was_truncated}
                    if was_truncated
                    else (metadata or {})
                ),
            }
        ).execute()
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
            truncated, was_truncated = _truncate_and_warn(
                input_summary, 4096, "input_summary", run_id
            )
            row["input_summary"] = truncated or input_summary
        r = (
            client.table("run_steps")
            .upsert(row, on_conflict="run_id,step_type")
            .execute()
        )
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
    output_json: dict[str, Any] | None = None,
) -> bool:
    """Update a run step to completed or failed. Optional trace fields and output JSON (e.g. monitor verified/failed)."""
    client = _client()
    if not client:
        return False
    try:
        from datetime import UTC, datetime

        payload = {"status": status}
        if output_json is not None:
            payload["output"] = output_json
        if output_summary is not None:
            truncated, was_truncated = _truncate_and_warn(
                output_summary, OUTPUT_SUMMARY_LIMIT, "output_summary", run_id
            )
            payload["output_summary"] = truncated
        if error_message is not None:
            truncated, _ = _truncate_and_warn(
                error_message, ERROR_MESSAGE_LIMIT, "error_message", run_id
            )
            payload["error_message"] = truncated
        payload["completed_at"] = completed_at or datetime.now(UTC).isoformat()
        if trace_blob_id is not None:
            payload["trace_blob_id"] = trace_blob_id
        if trace_da_cert is not None:
            payload["trace_da_cert"] = trace_da_cert
        if trace_reference_block is not None:
            payload["trace_reference_block"] = trace_reference_block
        client.table("run_steps").update(payload).eq("run_id", run_id).eq(
            "step_type", step_type
        ).execute()
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
        r = (
            client.table("run_steps")
            .select("*")
            .eq("run_id", run_id)
            .order("step_index")
            .execute()
        )
        return list(r.data) if r.data else []
    except Exception as e:
        logger.warning("[db] get_steps failed: %s", e)
        return []


def get_agent_logs(
    run_id: str, limit: int = 500, after_id: int | None = None
) -> list[dict[str, Any]]:
    """Return agent_logs for a run, ordered by created_at. Used by SSE stream for real-time logs.
    When after_id is set, only returns rows with id > after_id (cursor-based fetch)."""
    client = _client()
    if not client:
        return []
    try:
        q = (
            client.table("agent_logs")
            .select("id, agent_name, stage, log_level, message, created_at")
            .eq("run_id", run_id)
            .order("created_at")
            .limit(limit)
        )
        if after_id is not None:
            q = q.gt("id", after_id)
        r = q.execute()
        return list(r.data) if r.data else []
    except Exception as e:
        logger.warning("[db] get_agent_logs failed: %s", e)
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
        ts = _to_ts(
            row.get("completed_at") or row.get("started_at") or row.get("created_at")
        )
        msg = (
            row.get("output_summary")
            or row.get("error_message")
            or row.get("status")
            or ""
        )
        step = row.get("step_type") or ""
        if step and msg:
            msg = f"[{step}] {msg}"
        elif step:
            msg = f"[{step}] {row.get('status', '')}"
        level = "error" if row.get("status") == "failed" else "info"
        truncated_msg, _ = _truncate_and_warn(
            msg, 2048, "run_step log message", row.get("run_id")
        )
        out.append(
            {
                "message": truncated_msg or msg or "-",
                "level": level,
                "timestamp": ts,
                "service": step or "orchestrator",
            }
        )
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
        truncated_msg, _ = _truncate_and_warn(
            msg, 2048, "agent_log message", row.get("run_id")
        )
        out.append(
            {
                "message": truncated_msg or msg or "-",
                "level": level,
                "timestamp": ts,
                "service": agent or "agent",
            }
        )
    return out


def get_workflow_rich_from_artifacts(run_id: str) -> dict[str, Any]:
    """Assemble rich workflow fields from project_artifacts. Used when workflow_state blob is not written.
    Returns dict with spec, contracts, deployments, audit_findings, ui_schema, test_files (parsed from content JSON).
    """
    client = _client()
    if not client or not _is_uuid(run_id):
        return {}
    import json

    try:
        r = (
            client.table("project_artifacts")
            .select("artifact_type, content, created_at")
            .eq("run_id", run_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = list(r.data or [])
        out: dict[str, Any] = {}
        seen: set[str] = set()
        for row in rows:
            atype = (row.get("artifact_type") or "").strip()
            if not atype or atype in seen:
                continue
            seen.add(atype)
            content = row.get("content")
            if not content:
                continue
            try:
                parsed = json.loads(content) if isinstance(content, str) else content
            except (json.JSONDecodeError, TypeError):
                continue
            if atype == "spec":
                out["spec"] = parsed
            elif atype == "contracts":
                out["contracts"] = parsed
            elif atype == "deployment_record":
                out["deployments"] = parsed if isinstance(parsed, list) else [parsed]
            elif atype == "audit_report":
                out["audit_findings"] = parsed if isinstance(parsed, list) else [parsed]
            elif atype == "ui_schema":
                out["ui_schema"] = parsed
            elif atype == "test_files":
                out["test_files"] = parsed if isinstance(parsed, dict) else {}
        return out
    except Exception as e:
        logger.debug("[db] get_workflow_rich_from_artifacts failed: %s", e)
        return {}


def get_run_project_id(run_id: str) -> str | None:
    """Return project_id for run from runs table. None if missing."""
    client = _client()
    if not client or not _is_uuid(run_id):
        return None
    try:
        r = client.table("runs").select("project_id").eq("id", run_id).execute()
        row = (r.data or [{}])[0] if r.data else {}
        pid = row.get("project_id")
        return str(pid) if pid and _is_uuid(str(pid)) else None
    except Exception:
        return None


def get_workflow_state(run_id: str) -> dict[str, Any] | None:
    """Return workflow state json for run_id from runs.workflow_state. None if not configured or missing.
    Deprecated: new writes use run_state + project_artifacts only. Kept for backward compat with historical runs.
    """
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
        client.table("runs").update({"workflow_state": state}).eq(
            "id", run_id
        ).execute()
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


def list_workflow_states(
    limit: int = 50, status: str | None = None
) -> list[dict[str, Any]]:
    """List runs with workflow_state, newest first. status filters runs.status (store status mapped to run status)."""
    client = _client()
    if not client:
        return []
    try:
        run_status = _store_status_to_run_status(status) if status else None
        q = (
            client.table("runs")
            .select("id, workflow_state, status, created_at")
            .order("created_at", desc=True)
            .limit(min(limit, 500))
        )
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
                out.append(
                    {
                        "workflow_id": str(row["id"]),
                        "run_id": str(row["id"]),
                        "status": row.get("status"),
                        "created_at": row.get("created_at"),
                    }
                )
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


def count_completed_audits() -> int:
    """Count distinct runs that have a completed audit step (run_steps). More reliable than workflow_state."""
    client = _client()
    if not client:
        return 0
    try:
        r = (
            client.table("run_steps")
            .select("run_id")
            .eq("step_type", "audit")
            .eq("status", "completed")
            .execute()
        )
        run_ids = {row.get("run_id") for row in (r.data or []) if row.get("run_id")}
        return len(run_ids)
    except Exception as e:
        logger.warning("[db] count_completed_audits failed: %s", e)
        return 0


def count_completed_audits_from_run_state() -> int:
    """Count runs whose pipeline moved past the audit node (run_state.phase).

    Newer pipelines write run_state on every stage; run_steps may be missing on older or partial imports.
    Phases after audit completes: simulation (pass) or audit_failed (audit finished with gate failure).
    """
    client = _client()
    if not client:
        return 0
    phases_after_audit = (
        "simulation",
        "audit_failed",
        "security_policy_evaluator",
        "exploit_sim",
        "deploy",
        "monitor",
        "ui_scaffold",
    )
    try:
        r = (
            client.table("run_state")
            .select("run_id")
            .in_("phase", phases_after_audit)
            .execute()
        )
        run_ids = {row.get("run_id") for row in (r.data or []) if row.get("run_id")}
        return len(run_ids)
    except Exception as e:
        logger.debug("[db] count_completed_audits_from_run_state failed: %s", e)
        return 0


def count_security_findings() -> int:
    """Total count of security findings from security_findings table."""
    client = _client()
    if not client:
        return 0
    try:
        r = client.table("security_findings").select("id", count="exact").execute()
        return int(getattr(r, "count", 0) or 0)
    except Exception as e:
        logger.warning("[db] count_security_findings failed: %s", e)
        return 0


def list_security_findings(
    wallet_user_id: str | None = None,
    run_id: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """List security findings for user's runs (via projects.wallet_user_id) or a specific run."""
    client = _client()
    if not client:
        return []
    try:
        if run_id and _is_uuid(run_id):
            r = (
                client.table("security_findings")
                .select(
                    "id, run_id, tool, severity, category, title, description, location, status, created_at"
                )
                .eq("run_id", run_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return list(r.data) if r.data else []
        if wallet_user_id and _is_uuid(wallet_user_id):
            r_projects = (
                client.table("projects")
                .select("id")
                .eq("wallet_user_id", wallet_user_id)
                .execute()
            )
            project_ids = [p["id"] for p in (r_projects.data or []) if p.get("id")]
            if not project_ids:
                return []
            r_runs = (
                client.table("runs")
                .select("id")
                .in_("project_id", project_ids)
                .execute()
            )
            run_ids = [r["id"] for r in (r_runs.data or []) if r.get("id")]
            if not run_ids:
                return []
            r = (
                client.table("security_findings")
                .select(
                    "id, run_id, tool, severity, category, title, description, location, status, created_at"
                )
                .in_("run_id", run_ids[:500])
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return list(r.data) if r.data else []
        r = (
            client.table("security_findings")
            .select(
                "id, run_id, tool, severity, category, title, description, location, status, created_at"
            )
            .order("created_at", desc=True)
            .limit(min(limit, 500))
            .execute()
        )
        return list(r.data) if r.data else []
    except Exception as e:
        logger.warning("[db] list_security_findings failed: %s", e)
        return []


def count_distinct_auditors() -> int:
    """Count distinct users (wallet_user_id) who have completed at least one audit run."""
    client = _client()
    if not client:
        return 0
    try:
        r = (
            client.table("run_steps")
            .select("run_id, runs!inner(project_id, projects!inner(wallet_user_id))")
            .eq("step_type", "audit")
            .eq("status", "completed")
            .execute()
        )
        user_ids = set()
        for row in r.data or []:
            runs_data = row.get("runs")
            if isinstance(runs_data, dict):
                projects_data = runs_data.get("projects")
                if isinstance(projects_data, dict):
                    uid = projects_data.get("wallet_user_id") or projects_data.get(
                        "user_id"
                    )
                    if uid:
                        user_ids.add(str(uid))
        return len(user_ids)
    except Exception as e:
        logger.warning("[db] count_distinct_auditors failed: %s", e)
        return 0


def count_deployments() -> int:
    """Total deployment records (contracts deployed)."""
    client = _client()
    if not client:
        return 0
    try:
        r = client.table("deployments").select("id", count="exact").execute()
        return int(getattr(r, "count", 0) or 0)
    except Exception as e:
        logger.warning("[db] count_deployments failed: %s", e)
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
            .select(
                "run_id, step_type, status, output_summary, error_message, started_at, completed_at, created_at"
            )
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


def list_storage_records_for_reconciliation(
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Rows needing gateway re-verification (pinned/failed, ipfs). Empty if misconfigured or schema mismatch."""
    client = _client()
    if not client:
        return []
    try:
        r = (
            client.table("storage_records")
            .select("id,cid,gateway_url,status,metadata,storage_type")
            .eq("storage_type", "ipfs")
            .in_("status", ["pinned", "failed"])
            .limit(limit)
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[db] list_storage_records_for_reconciliation failed: %s", e)
        return []


def patch_storage_record(record_id: str, fields: dict[str, Any]) -> bool:
    """Update storage_records by primary key."""
    client = _client()
    if not client or not record_id or not fields:
        return False
    try:
        client.table("storage_records").update(fields).eq("id", record_id).execute()
        return True
    except Exception as e:
        logger.warning("[db] patch_storage_record failed: %s", e)
        return False


def update_storage_records_by_cid(
    cid: str,
    fields: dict[str, Any],
    storage_type: str = "ipfs",
) -> bool:
    """Update all matching pipeline rows (e.g. webhook confirms pin)."""
    client = _client()
    if not client or not cid or not fields:
        return False
    try:
        q = client.table("storage_records").update(fields).eq("cid", cid)
        if storage_type:
            q = q.eq("storage_type", storage_type)
        q.execute()
        return True
    except Exception as e:
        logger.warning("[db] update_storage_records_by_cid failed: %s", e)
        return False


def merge_metadata_dict(existing: Any, patch: dict[str, Any]) -> dict[str, Any]:
    """Merge JSONB metadata with a patch dict."""
    base: dict[str, Any]
    if existing is None:
        base = {}
    elif isinstance(existing, dict):
        base = dict(existing)
    elif isinstance(existing, str):
        import json

        try:
            base = dict(json.loads(existing))
        except Exception:
            base = {}
    else:
        base = {}
    base.update(patch)
    return base


def list_storage_records_for_filecoin_deal_poll(
    limit: int = 25,
    status: str = "deal_pending",
) -> list[dict[str, Any]]:
    """Filecoin rows awaiting deal status updates (Lighthouse)."""
    client = _client()
    if not client:
        return []
    try:
        r = (
            client.table("storage_records")
            .select("id,cid,gateway_url,status,metadata,storage_type")
            .eq("storage_type", "filecoin")
            .eq("status", status)
            .limit(limit)
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[db] list_storage_records_for_filecoin_deal_poll failed: %s", e)
        return []


def reconcile_storage_records_webhook(
    cid: str,
    status: str,
    meta_patch: dict[str, Any],
    storage_type: str = "ipfs",
) -> int:
    """Select rows by cid, merge metadata, set status. Returns count of rows updated."""
    client = _client()
    if not client or not cid:
        return 0
    n = 0
    try:
        r = (
            client.table("storage_records")
            .select("id,metadata")
            .eq("cid", cid)
            .eq("storage_type", storage_type)
            .execute()
        )
        for row in r.data or []:
            rid = row.get("id")
            if not rid:
                continue
            merged = merge_metadata_dict(row.get("metadata"), meta_patch)
            if patch_storage_record(str(rid), {"status": status, "metadata": merged}):
                n += 1
        return n
    except Exception as e:
        logger.warning("[db] reconcile_storage_records_webhook failed: %s", e)
        return 0
