"""ERC-8004 registry index + A2A task/message APIs (operational truth in Supabase).

On-chain trust registry and A2A transport are separate; this mirrors pointers and state.
Does not replace GET /api/v1/agents (pipeline agents) — use prefix /api/v1/agent-registry.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import db
import registry_a2a_store as store

logger = logging.getLogger(__name__)

registry_router = APIRouter(
    prefix="/api/v1/agent-registry",
    tags=["agent-registry"],
)
a2a_router = APIRouter(prefix="/api/v1/a2a", tags=["a2a"])
erc8004_router = APIRouter(prefix="/api/v1/erc8004", tags=["erc8004"])

_BAD_STATUSES = frozenset({"suspended", "deprecated"})


def _require_db() -> None:
    if not db.is_configured():
        raise HTTPException(status_code=503, detail="database not configured")


# --- Registry: agents ---


class RegisterAgentBody(BaseModel):
    owner_service: str = Field(..., min_length=1, max_length=256)
    name: str = Field(..., min_length=1, max_length=512)
    capabilities: list[str] = Field(default_factory=list)
    chain_id: int = Field(..., ge=1, le=2_147_483_647)
    registry_cid: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    wallet_user_id: str | None = None


@registry_router.post("/agents")
def register_agent(body: RegisterAgentBody) -> dict[str, Any]:
    _require_db()
    caps = [str(c).strip() for c in body.capabilities if str(c).strip()]
    row = store.insert_registry_agent(
        owner_service=body.owner_service,
        name=body.name,
        chain_id=body.chain_id,
        capabilities=caps,
        registry_cid=body.registry_cid,
        metadata=body.metadata,
        wallet_user_id=body.wallet_user_id,
        status="registered",
    )
    if not row:
        raise HTTPException(status_code=500, detail="failed to register agent")
    return {
        "agent_id": row["id"],
        "status": row.get("status", "registered"),
        "registry_cid": row.get("registry_cid"),
    }


@registry_router.get("/agents/{agent_id}")
def get_agent(agent_id: str) -> dict[str, Any]:
    _require_db()
    row = store.get_registry_agent(agent_id)
    if not row:
        raise HTTPException(status_code=404, detail="agent not found")
    rep = store.latest_reputation_score(agent_id)
    out = dict(row)
    if rep is not None:
        out["trust_score_latest"] = rep
    return out


@registry_router.get("/agents")
def list_agents(
    capability: str | None = None,
    chain_id: int | None = None,
    status: str | None = None,
    owner_service: str | None = None,
    discoverable_only: bool = Query(
        True,
        description="Exclude suspended/deprecated unless status is set explicitly",
    ),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    _require_db()
    rows = store.list_registry_agents(
        capability=capability,
        chain_id=chain_id,
        status=status,
        owner_service=owner_service,
        limit=limit,
    )
    if discoverable_only and not status:
        rows = [r for r in rows if r.get("status") not in _BAD_STATUSES]
    return {"agents": rows, "total": len(rows)}


@registry_router.post("/agents/{agent_id}/deprecate")
def deprecate_agent(agent_id: str) -> dict[str, Any]:
    _require_db()
    if not store.get_registry_agent(agent_id):
        raise HTTPException(status_code=404, detail="agent not found")
    ok = store.update_registry_agent_status(agent_id, "deprecated")
    if not ok:
        raise HTTPException(status_code=500, detail="failed to deprecate")
    return {"agent_id": agent_id, "status": "deprecated"}


# --- Attestations / reputation ---


class AttestationBody(BaseModel):
    attester: str = Field(..., min_length=1, max_length=256)
    type: str = Field(..., min_length=1, max_length=128)
    attestation_cid: str | None = None
    score_delta: float | None = None


@registry_router.post("/agents/{agent_id}/attestations")
def post_attestation(agent_id: str, body: AttestationBody) -> dict[str, Any]:
    _require_db()
    if not store.get_registry_agent(agent_id):
        raise HTTPException(status_code=404, detail="agent not found")
    row = store.insert_attestation(
        agent_id=agent_id,
        attester=body.attester,
        att_type=body.type,
        attestation_cid=body.attestation_cid,
        score_delta=body.score_delta,
    )
    if not row:
        raise HTTPException(status_code=500, detail="failed to store attestation")
    # Evidence-backed reputation snapshot row
    if body.score_delta is not None:
        prev = store.latest_reputation_score(agent_id) or 0.0
        try:
            new_score = float(prev) + float(body.score_delta)
        except (TypeError, ValueError):
            new_score = float(prev)
        store.insert_reputation(
            agent_id=agent_id,
            score=new_score,
            evidence_cid=body.attestation_cid,
            source=body.attester,
        )
    return {"attestation_id": row["id"], "status": "recorded"}


@registry_router.get("/agents/{agent_id}/reputation")
def get_reputation(agent_id: str) -> dict[str, Any]:
    _require_db()
    if not store.get_registry_agent(agent_id):
        raise HTTPException(status_code=404, detail="agent not found")
    rows = store.list_reputations(agent_id, limit=50)
    latest = store.latest_reputation_score(agent_id)
    return {"agent_id": agent_id, "latest_score": latest, "history": rows}


# --- Capabilities discovery ---


def _collect_capabilities_from_agents() -> list[str]:
    rows = store.list_registry_agents(limit=500)
    seen: set[str] = set()
    out: list[str] = []
    for r in rows:
        if r.get("status") in _BAD_STATUSES:
            continue
        for c in r.get("capabilities") or []:
            s = str(c).strip()
            if s and s.lower() not in seen:
                seen.add(s.lower())
                out.append(s)
    return sorted(out)


@registry_router.get("/capabilities")
def list_capabilities() -> dict[str, Any]:
    _require_db()
    return {"capabilities": _collect_capabilities_from_agents()}


@registry_router.get("/capabilities/{name}/agents")
def agents_for_capability(
    name: str,
    chain_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    _require_db()
    needle = name.strip().lower()
    if not needle:
        raise HTTPException(status_code=400, detail="invalid capability name")
    rows = store.list_registry_agents(
        capability=name, chain_id=chain_id, limit=limit
    )
    rows = [r for r in rows if r.get("status") not in _BAD_STATUSES]
    return {"capability": name, "agents": rows, "total": len(rows)}


# --- A2A tasks ---


class CreateTaskBody(BaseModel):
    workflow_id: str | None = None
    run_id: str = Field(..., min_length=1, max_length=256)
    capability_requested: str = Field(..., min_length=1, max_length=256)
    priority: Literal["low", "normal", "high"] = "normal"
    timeout_seconds: int = Field(300, ge=1, le=86400)
    payload_cid: str | None = None
    trace_id: str = Field(..., min_length=1, max_length=256)


@a2a_router.post("/tasks")
def create_task(body: CreateTaskBody) -> dict[str, Any]:
    _require_db()
    prio = body.priority
    row = store.insert_a2a_task(
        workflow_id=body.workflow_id,
        run_id=body.run_id,
        capability_requested=body.capability_requested,
        priority=prio,
        timeout_seconds=body.timeout_seconds,
        payload_cid=body.payload_cid,
        trace_id=body.trace_id,
    )
    if not row:
        raise HTTPException(
            status_code=400,
            detail="failed to create task (trace_id and run_id required)",
        )
    return {"task_id": row["id"], "status": row.get("status", "queued")}


@a2a_router.get("/tasks/{task_id}")
def get_task(task_id: str) -> dict[str, Any]:
    _require_db()
    row = store.get_a2a_task(task_id)
    if not row:
        raise HTTPException(status_code=404, detail="task not found")
    return row


class DispatchBody(BaseModel):
    agent_id: str = Field(..., min_length=32, max_length=64)
    selection_reason: str | None = None


@a2a_router.post("/tasks/{task_id}/dispatch")
def dispatch_task(task_id: str, body: DispatchBody) -> dict[str, Any]:
    _require_db()
    aid = body.agent_id.strip()
    if not db.is_uuid(aid):
        raise HTTPException(status_code=400, detail="invalid agent_id")
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") not in ("queued",):
        raise HTTPException(
            status_code=409, detail="task is not queued for dispatch"
        )
    agent = store.get_registry_agent(aid)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    st = agent.get("status") or ""
    if st not in store.AGENT_DISPATCH_OK:
        raise HTTPException(
            status_code=400,
            detail=f"agent not eligible for dispatch (status={st})",
        )
    trust = store.latest_reputation_score(aid)
    store.update_a2a_task(
        task_id,
        {
            "selected_agent_id": aid,
            "status": "dispatched",
            "selection_reason": (body.selection_reason or "")[:2000] or None,
            "trust_score": trust,
        },
    )
    tid = task.get("trace_id") or ""
    store.insert_message(
        task_id=task_id,
        sender_agent_id=None,
        receiver_agent_id=aid,
        message_type="task_request",
        payload_cid=task.get("payload_cid"),
        trace_id=tid,
        status="sent",
    )
    return {"status": "dispatched", "agent_id": aid}


@a2a_router.post("/tasks/{task_id}/ack")
def ack_task(task_id: str) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") not in ("dispatched", "running"):
        raise HTTPException(status_code=409, detail="invalid state for ack")
    store.update_a2a_task(task_id, {"status": "acknowledged"})
    store.acknowledge_messages_for_task(task_id)
    return {"status": "acknowledged"}


class CompleteBody(BaseModel):
    output_cid: str | None = None
    summary: str = ""
    success: bool = True
    artifact_type: str = "result"


@a2a_router.post("/tasks/{task_id}/complete")
def complete_task(task_id: str, body: CompleteBody) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") in ("failed", "canceled", "timed_out"):
        raise HTTPException(status_code=409, detail="task already terminal")
    if body.success and not (body.output_cid and str(body.output_cid).strip()):
        raise HTTPException(
            status_code=400,
            detail="output_cid required for successful completion",
        )
    if not body.success:
        store.update_a2a_task(task_id, {"status": "failed"})
        store.suppress_nonfinal_outputs_for_failed_task(task_id)
        store.mark_messages_responded(task_id)
        if body.output_cid:
            store.insert_task_output(
                task_id=task_id,
                artifact_type=body.artifact_type[:128] or "result",
                cid=body.output_cid,
                content_hash=None,
                status="failed",
            )
        return {"status": "failed", "success": False, "summary": body.summary}
    store.update_a2a_task(task_id, {"status": "completed"})
    store.mark_messages_responded(task_id)
    store.insert_task_output(
        task_id=task_id,
        artifact_type=body.artifact_type[:128] or "result",
        cid=body.output_cid,
        content_hash=None,
        status="published",
    )
    return {"status": "completed", "success": True, "summary": body.summary}


class FailBody(BaseModel):
    error: str = Field(..., min_length=1, max_length=4000)
    error_cid: str | None = None
    retryable: bool = True


@a2a_router.post("/tasks/{task_id}/fail")
def fail_task(task_id: str, body: FailBody) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    store.update_a2a_task(task_id, {"status": "failed"})
    store.suppress_nonfinal_outputs_for_failed_task(task_id)
    if body.error_cid:
        store.insert_task_output(
            task_id=task_id,
            artifact_type="error",
            cid=body.error_cid,
            content_hash=None,
            status="failed",
        )
    return {
        "status": "failed",
        "error": body.error[:4000],
        "retryable": body.retryable,
    }


@a2a_router.post("/tasks/{task_id}/retry")
def retry_task(task_id: str) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") not in ("failed", "timed_out"):
        raise HTTPException(status_code=409, detail="task is not in a failed state")
    store.update_a2a_task(
        task_id,
        {
            "status": "queued",
            "selected_agent_id": None,
            "selection_reason": None,
            "trust_score": None,
        },
    )
    return {"status": "queued", "task_id": task_id}


@a2a_router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") in ("completed", "failed", "canceled"):
        raise HTTPException(status_code=409, detail="task already terminal")
    store.update_a2a_task(task_id, {"status": "canceled"})
    store.suppress_nonfinal_outputs_for_failed_task(task_id)
    return {"status": "canceled"}


@a2a_router.post("/tasks/{task_id}/resume")
def resume_task(task_id: str) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    return {
        "task_id": task_id,
        "status": task.get("status"),
        "message": "resume is a stub; wire checkpoint consumer if supported",
    }


class CheckpointBody(BaseModel):
    checkpoint_cid: str | None = None
    state_type: str | None = Field(None, max_length=64)


@a2a_router.post("/tasks/{task_id}/checkpoint")
def checkpoint_task(task_id: str, body: CheckpointBody) -> dict[str, Any]:
    _require_db()
    if not store.get_a2a_task(task_id):
        raise HTTPException(status_code=404, detail="task not found")
    row = store.insert_checkpoint(
        task_id, body.checkpoint_cid, body.state_type
    )
    if not row:
        raise HTTPException(status_code=500, detail="failed to record checkpoint")
    store.update_a2a_task(task_id, {"status": "partial_result"})
    return {"checkpoint_id": row["id"], "status": "partial_result"}


# --- Messages ---


class MessageBody(BaseModel):
    sender_agent_id: str | None = None
    receiver_agent_id: str | None = None
    task_id: str = Field(..., min_length=36, max_length=36)
    message_type: str = Field(..., min_length=1, max_length=128)
    payload_cid: str | None = None
    trace_id: str = Field(..., min_length=1, max_length=256)


@a2a_router.post("/messages")
def create_message(body: MessageBody) -> dict[str, Any]:
    _require_db()
    if not store.get_a2a_task(body.task_id):
        raise HTTPException(status_code=404, detail="task not found")
    row = store.insert_message(
        task_id=body.task_id,
        sender_agent_id=body.sender_agent_id,
        receiver_agent_id=body.receiver_agent_id,
        message_type=body.message_type,
        payload_cid=body.payload_cid,
        trace_id=body.trace_id,
        status="sent",
    )
    if not row:
        raise HTTPException(status_code=400, detail="failed to create message")
    return {"message_id": row["id"], "status": row.get("status", "sent")}


@a2a_router.get("/messages/{message_id}")
def get_message(message_id: str) -> dict[str, Any]:
    _require_db()
    row = store.get_message(message_id)
    if not row:
        raise HTTPException(status_code=404, detail="message not found")
    return row


@a2a_router.get("/tasks/{task_id}/messages")
def list_task_messages(task_id: str) -> dict[str, Any]:
    _require_db()
    if not store.get_a2a_task(task_id):
        raise HTTPException(status_code=404, detail="task not found")
    rows = store.list_messages_for_task(task_id)
    return {"task_id": task_id, "messages": rows, "total": len(rows)}


# --- Artifacts ---


class ArtifactBody(BaseModel):
    artifact_type: str = Field(..., min_length=1, max_length=128)
    cid: str | None = None
    content_hash: str | None = None
    status: str = Field("pending", max_length=32)


@a2a_router.post("/tasks/{task_id}/artifacts")
def attach_artifact(task_id: str, body: ArtifactBody) -> dict[str, Any]:
    _require_db()
    task = store.get_a2a_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="task not found")
    if task.get("status") == "failed":
        raise HTTPException(
            status_code=409,
            detail="failed tasks must not silently promote outputs",
        )
    row = store.insert_task_output(
        task_id=task_id,
        artifact_type=body.artifact_type,
        cid=body.cid,
        content_hash=body.content_hash,
        status=body.status,
    )
    if not row:
        raise HTTPException(status_code=500, detail="failed to attach artifact")
    return {"output_id": row["id"], "status": row.get("status")}


@a2a_router.get("/tasks/{task_id}/artifacts")
def list_artifacts(task_id: str) -> dict[str, Any]:
    _require_db()
    if not store.get_a2a_task(task_id):
        raise HTTPException(status_code=404, detail="task not found")
    rows = store.list_task_outputs(task_id)
    return {"task_id": task_id, "artifacts": rows, "total": len(rows)}


# --- ERC-8004 sync (not implemented: no on-chain indexer in this deployment) ---


@erc8004_router.post("/sync")
def erc8004_sync() -> dict[str, Any]:
    """Registry mirror sync from chain is not shipped yet. Fail honestly (no fake synced count)."""
    _require_db()
    logger.warning(
        "[erc8004] sync requested but indexer is not implemented — returning 501"
    )
    raise HTTPException(
        status_code=501,
        detail=(
            "ERC-8004 registry sync is not implemented. "
            "There is no deployed indexer to reconcile on-chain IdentityRegistry state into "
            "registry_agents. Do not treat sync as available until this ships."
        ),
    )


@erc8004_router.get("/agents/{agent_id}")
def erc8004_get_agent(agent_id: str) -> dict[str, Any]:
    _require_db()
    row = store.get_registry_agent(agent_id)
    if not row:
        raise HTTPException(status_code=404, detail="agent not found")
    return {
        "agent": row,
        "anchored": bool(row.get("registry_cid")),
        "source": "supabase_mirror",
    }
