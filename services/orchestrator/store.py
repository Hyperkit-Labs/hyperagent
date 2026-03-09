"""
Workflow store: Supabase (runs.workflow_state) as source of truth when configured; in-memory fallback for dev.
"""
from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

import db as _db


def _ensure_contracts_dict(raw: Any) -> dict[str, Any]:
    """Normalize contracts to dict[str, str]. Handles legacy list format to fix 'list' object has no attribute 'keys'."""
    if isinstance(raw, dict):
        return {k: v for k, v in raw.items() if isinstance(v, str)}
    if isinstance(raw, list):
        out: dict[str, str] = {}
        for i, item in enumerate(raw):
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("filename") or item.get("contract_name")
            code = item.get("source") or item.get("code") or item.get("source_code")
            if isinstance(name, str) and isinstance(code, str):
                if not name.endswith(".sol"):
                    name = f"{name}.sol"
                out[name] = code
            elif isinstance(code, str):
                out[f"Contract_{i}.sol"] = code
        return out
    return {}

_workflows: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()

MAX_INTENT_LENGTH = 10_000


def _new_record(
    workflow_id: str,
    intent: str,
    network: str | None = None,
    user_id: str = "",
    project_id: str = "",
    template_id: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    return {
        "workflow_id": workflow_id,
        "name": None,
        "intent": (intent or "")[:MAX_INTENT_LENGTH],
        "contract_type": None,
        "status": "running",
        "network": network or "",
        "stages": [],
        "created_at": now,
        "updated_at": now,
        "meta_data": {},
        "metadata": {},
        "contracts": {},
        "deployments": [],
        "ui_schema": None,
        "run_id": workflow_id,
        "template_id": template_id or None,
        "codegen_mode": None,
        "oz_wizard_options": None,
        "spec": None,
        "spec_approved": False,
        "user_id": user_id,
        "project_id": project_id,
        "simulation_passed": False,
        "simulation_results": [],
        "audit_findings": [],
        "test_files": {},
    }


def create_workflow(
    workflow_id: str,
    intent: str,
    network: str | None = None,
    user_id: str = "",
    project_id: str = "",
    template_id: str | None = None,
) -> dict[str, Any]:
    """Create a new workflow record; persist to Supabase when configured, always keep in-memory copy."""
    record = _new_record(workflow_id, intent, network, user_id, project_id, template_id)
    with _lock:
        _workflows[workflow_id] = record
    if _db.is_configured():
        _db.upsert_workflow_state(workflow_id, record)
    return record


def update_workflow(
    workflow_id: str,
    status: str | None = None,
    current_stage: str | None = None,
    stages: list[dict[str, Any]] | None = None,
    contracts: dict[str, Any] | None = None,
    deployments: list[dict[str, Any]] | None = None,
    ui_schema: dict[str, Any] | None = None,
    error: str | None = None,
    codegen_mode: str | None = None,
    oz_wizard_options: dict[str, Any] | None = None,
    spec: dict[str, Any] | None = None,
    spec_approved: bool | None = None,
    simulation_passed: bool | None = None,
    simulation_results: list[dict[str, Any]] | dict[str, Any] | None = None,
    audit_findings: list[dict[str, Any]] | None = None,
    test_files: dict[str, Any] | None = None,
    metadata_merge: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Update an existing workflow record; persist to Supabase when configured."""
    now = datetime.now(UTC).isoformat()
    rec = None
    if _db.is_configured():
        rec = _db.get_workflow_state(workflow_id)
    if rec is None:
        with _lock:
            rec = _workflows.get(workflow_id)
            if rec:
                rec = dict(rec)
    if not rec:
        return None
    if status is not None:
        rec["status"] = _normalize_status(status)
    if current_stage is not None:
        rec["current_stage"] = current_stage
    if stages is not None:
        rec["stages"] = stages
    if contracts is not None:
        rec["contracts"] = contracts
    if deployments is not None:
        rec["deployments"] = deployments
    if ui_schema is not None:
        rec["ui_schema"] = ui_schema
    if error is not None:
        rec["metadata"] = {**(rec.get("metadata") or {}), "error": error}
    if codegen_mode is not None:
        rec["codegen_mode"] = codegen_mode
    if oz_wizard_options is not None:
        rec["oz_wizard_options"] = oz_wizard_options
    if spec is not None:
        rec["spec"] = spec
    if spec_approved is not None:
        rec["spec_approved"] = spec_approved
    if simulation_passed is not None:
        rec["simulation_passed"] = simulation_passed
    if simulation_results is not None:
        rec["simulation_results"] = simulation_results
    if audit_findings is not None:
        rec["audit_findings"] = audit_findings
    if test_files is not None:
        rec["test_files"] = test_files
    if metadata_merge is not None:
        rec["metadata"] = {**(rec.get("metadata") or {}), **metadata_merge}
    rec["updated_at"] = now
    with _lock:
        _workflows[workflow_id] = rec
    if _db.is_configured():
        _db.upsert_workflow_state(workflow_id, rec)
    return rec


def _normalize_status(stage: str) -> str:
    """Map pipeline stage to Studio-friendly status."""
    if stage in ("completed", "deployed", "deploy", "ui_scaffold"):
        return "completed"
    if stage in ("audit_failed", "simulation_failed", "failed"):
        return "failed"
    if stage in ("cancelled",):
        return "cancelled"
    if stage in ("running", "pending"):
        return stage
    if stage in ("spec_review", "design_review", "audit", "simulation", "codegen", "design", "spec"):
        return "building"
    return "building" if stage else "unknown"


def get_workflow(workflow_id: str) -> dict[str, Any] | None:
    """Return workflow by id; from Supabase when configured."""
    if _db.is_configured():
        rec = _db.get_workflow_state(workflow_id)
        if rec:
            rec = dict(rec)
            rec["contracts"] = _ensure_contracts_dict(rec.get("contracts"))
            return rec
    with _lock:
        rec = _workflows.get(workflow_id)
        if rec:
            rec = dict(rec)
            rec["contracts"] = _ensure_contracts_dict(rec.get("contracts"))
            return rec
        return None


def list_workflows(limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    """List workflows, newest first; from Supabase when configured."""
    if _db.is_configured():
        return _db.list_workflow_states(limit=limit, status=status)
    with _lock:
        items = list(_workflows.values())
    items.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    if status:
        items = [r for r in items if (r.get("status") or "").lower() == status.lower()]
    return items[:limit]


def count_workflows() -> int:
    """Total workflow count for metrics."""
    if _db.is_configured():
        return _db.count_runs()
    with _lock:
        return len(_workflows)


def append_deployment(workflow_id: str, deployment: dict[str, Any]) -> dict[str, Any] | None:
    """Append one deployment record to workflow; persist to Supabase when configured."""
    now = datetime.now(UTC).isoformat()
    rec = get_workflow(workflow_id)
    if not rec:
        return None
    rec = dict(rec)
    deploys = list(rec.get("deployments") or [])
    deploys.append({**deployment, "created_at": now})
    rec["deployments"] = deploys
    rec["updated_at"] = now
    if _db.is_configured():
        _db.upsert_workflow_state(workflow_id, rec)
    else:
        with _lock:
            _workflows[workflow_id] = rec
    return rec
