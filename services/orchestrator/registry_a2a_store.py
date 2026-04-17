"""Supabase persistence for registry_agents, A2A tasks/messages (ERC-8004 + A2A operational index)."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import db

logger = logging.getLogger(__name__)

# Agent lifecycle: mirrored in DB; on-chain registry is separate.
AGENT_DISCOVERABLE_STATUSES = frozenset(
    {"registered", "discoverable", "eligible", "selected", "active", "completed"}
)
# Includes registered so a newly mirrored agent can receive tasks before promotion to discoverable.
AGENT_DISPATCH_OK = frozenset({"registered", "discoverable", "eligible"})


def _now() -> str:
    return datetime.now(UTC).isoformat()


def insert_registry_agent(
    owner_service: str,
    name: str,
    chain_id: int,
    capabilities: list[str],
    registry_cid: str | None,
    metadata: dict[str, Any],
    wallet_user_id: str | None = None,
    status: str = "registered",
) -> dict[str, Any] | None:
    if not db.is_configured():
        return None
    client = db._client()
    if not client:
        return None
    row = {
        "owner_service": owner_service[:256],
        "name": name[:512],
        "chain_id": chain_id,
        "capabilities": capabilities,
        "registry_cid": registry_cid,
        "metadata": metadata or {},
        "status": status,
        "updated_at": _now(),
    }
    if wallet_user_id and db.is_uuid(wallet_user_id):
        row["wallet_user_id"] = wallet_user_id
    try:
        r = client.table("registry_agents").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_registry_agent failed: %s", e)
        return None


def upsert_registry_agent(row: dict[str, Any]) -> dict[str, Any] | None:
    """Upsert a registry agent row keyed on agent_id (string slug, not UUID).

    Used by the ERC-8004 sync endpoint to mirror YAML-backed registrations.
    Merges on the `agent_id` unique column so repeated syncs are idempotent.
    """
    if not db.is_configured():
        return None
    client = db._client()
    if not client:
        return None
    upsert_row = dict(row)
    upsert_row["updated_at"] = _now()
    try:
        r = (
            client.table("registry_agents")
            .upsert(upsert_row, on_conflict="agent_id")
            .execute()
        )
        return r.data[0] if r.data else upsert_row
    except Exception as e:
        logger.warning("[registry_a2a] upsert_registry_agent failed: %s", e)
        return None


def get_registry_agent(agent_id: str) -> dict[str, Any] | None:
    if not db.is_uuid(agent_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("registry_agents")
            .select("*")
            .eq("id", agent_id)
            .limit(1)
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] get_registry_agent failed: %s", e)
        return None


def list_registry_agents(
    *,
    capability: str | None = None,
    chain_id: int | None = None,
    status: str | None = None,
    owner_service: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    if not db.is_configured():
        return []
    client = db._client()
    if not client:
        return []
    try:
        q = client.table("registry_agents").select("*")
        if chain_id is not None:
            q = q.eq("chain_id", chain_id)
        if status:
            q = q.eq("status", status)
        if owner_service:
            q = q.eq("owner_service", owner_service)
        r = q.order("updated_at", desc=True).limit(min(limit, 200)).execute()
        rows = list(r.data or [])
        if capability and capability.strip():
            cap_l = capability.strip().lower()
            out: list[dict[str, Any]] = []
            for row in rows:
                caps = row.get("capabilities") or []
                if isinstance(caps, list) and any(
                    str(c).lower() == cap_l or cap_l in str(c).lower() for c in caps
                ):
                    out.append(row)
            return out
        return rows
    except Exception as e:
        logger.warning("[registry_a2a] list_registry_agents failed: %s", e)
        return []


def update_registry_agent_status(agent_id: str, status: str) -> bool:
    if not db.is_uuid(agent_id):
        return False
    client = db._client()
    if not client:
        return False
    try:
        client.table("registry_agents").update(
            {"status": status, "updated_at": _now()}
        ).eq("id", agent_id).execute()
        return True
    except Exception as e:
        logger.warning("[registry_a2a] update_registry_agent_status failed: %s", e)
        return False


def insert_reputation(
    agent_id: str, score: float, evidence_cid: str | None, source: str | None
) -> dict[str, Any] | None:
    if not db.is_uuid(agent_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("registry_agent_reputations")
            .insert(
                {
                    "agent_id": agent_id,
                    "score": score,
                    "evidence_cid": evidence_cid,
                    "source": (source or "")[:256] or None,
                }
            )
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_reputation failed: %s", e)
        return None


def list_reputations(agent_id: str, limit: int = 20) -> list[dict[str, Any]]:
    if not db.is_uuid(agent_id):
        return []
    client = db._client()
    if not client:
        return []
    try:
        r = (
            client.table("registry_agent_reputations")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(min(limit, 100))
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[registry_a2a] list_reputations failed: %s", e)
        return []


def insert_attestation(
    agent_id: str,
    attester: str,
    att_type: str,
    attestation_cid: str | None,
    score_delta: float | None,
) -> dict[str, Any] | None:
    if not db.is_uuid(agent_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("registry_agent_attestations")
            .insert(
                {
                    "agent_id": agent_id,
                    "attester": attester[:256],
                    "type": att_type[:128],
                    "attestation_cid": attestation_cid,
                    "score_delta": score_delta,
                }
            )
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_attestation failed: %s", e)
        return None


def list_attestations(agent_id: str, limit: int = 50) -> list[dict[str, Any]]:
    if not db.is_uuid(agent_id):
        return []
    client = db._client()
    if not client:
        return []
    try:
        r = (
            client.table("registry_agent_attestations")
            .select("*")
            .eq("agent_id", agent_id)
            .order("created_at", desc=True)
            .limit(min(limit, 100))
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[registry_a2a] list_attestations failed: %s", e)
        return []


def insert_a2a_task(
    *,
    workflow_id: str | None,
    run_id: str,
    capability_requested: str,
    priority: str,
    timeout_seconds: int,
    payload_cid: str | None,
    trace_id: str,
) -> dict[str, Any] | None:
    if not trace_id or not str(trace_id).strip():
        return None
    if not run_id or not str(run_id).strip():
        return None
    client = db._client()
    if not client:
        return None
    row: dict[str, Any] = {
        "run_id": run_id.strip(),
        "capability_requested": capability_requested[:256],
        "priority": priority[:32],
        "timeout_seconds": max(1, min(timeout_seconds, 86400)),
        "payload_cid": payload_cid,
        "trace_id": trace_id.strip()[:256],
        "status": "queued",
        "updated_at": _now(),
    }
    if workflow_id:
        row["workflow_id"] = workflow_id[:128]
    try:
        r = client.table("a2a_tasks").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_a2a_task failed: %s", e)
        return None


def get_a2a_task(task_id: str) -> dict[str, Any] | None:
    if not db.is_uuid(task_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = client.table("a2a_tasks").select("*").eq("id", task_id).limit(1).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] get_a2a_task failed: %s", e)
        return None


def update_a2a_task(task_id: str, fields: dict[str, Any]) -> bool:
    if not db.is_uuid(task_id):
        return False
    client = db._client()
    if not client:
        return False
    payload = {**fields, "updated_at": _now()}
    try:
        client.table("a2a_tasks").update(payload).eq("id", task_id).execute()
        return True
    except Exception as e:
        logger.warning("[registry_a2a] update_a2a_task failed: %s", e)
        return False


def insert_message(
    *,
    task_id: str,
    sender_agent_id: str | None,
    receiver_agent_id: str | None,
    message_type: str,
    payload_cid: str | None,
    trace_id: str,
    status: str = "sent",
) -> dict[str, Any] | None:
    if not db.is_uuid(task_id) or not trace_id.strip():
        return None
    client = db._client()
    if not client:
        return None
    row: dict[str, Any] = {
        "task_id": task_id,
        "message_type": message_type[:128],
        "payload_cid": payload_cid,
        "trace_id": trace_id.strip()[:256],
        "status": status,
        "sent_at": _now(),
    }
    if sender_agent_id and db.is_uuid(sender_agent_id):
        row["sender_agent_id"] = sender_agent_id
    if receiver_agent_id and db.is_uuid(receiver_agent_id):
        row["receiver_agent_id"] = receiver_agent_id
    try:
        r = client.table("a2a_messages").insert(row).execute()
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_message failed: %s", e)
        return None


def get_message(message_id: str) -> dict[str, Any] | None:
    if not db.is_uuid(message_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("a2a_messages")
            .select("*")
            .eq("id", message_id)
            .limit(1)
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] get_message failed: %s", e)
        return None


def list_messages_for_task(task_id: str) -> list[dict[str, Any]]:
    if not db.is_uuid(task_id):
        return []
    client = db._client()
    if not client:
        return []
    try:
        r = (
            client.table("a2a_messages")
            .select("*")
            .eq("task_id", task_id)
            .order("created_at", desc=False)
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[registry_a2a] list_messages_for_task failed: %s", e)
        return []


def acknowledge_messages_for_task(task_id: str) -> bool:
    """Set ack_at and status on messages for this task (A2A ack)."""
    if not db.is_uuid(task_id):
        return False
    client = db._client()
    if not client:
        return False
    now = _now()
    try:
        client.table("a2a_messages").update(
            {"ack_at": now, "status": "acknowledged"}
        ).eq("task_id", task_id).execute()
        return True
    except Exception as e:
        logger.warning("[registry_a2a] acknowledge_messages_for_task failed: %s", e)
        return False


def mark_messages_responded(task_id: str) -> bool:
    if not db.is_uuid(task_id):
        return False
    client = db._client()
    if not client:
        return False
    now = _now()
    try:
        client.table("a2a_messages").update(
            {"completed_at": now, "status": "responded"}
        ).eq("task_id", task_id).execute()
        return True
    except Exception as e:
        logger.warning("[registry_a2a] mark_messages_responded failed: %s", e)
        return False


def insert_task_output(
    task_id: str,
    artifact_type: str,
    cid: str | None,
    content_hash: str | None,
    status: str,
) -> dict[str, Any] | None:
    if not db.is_uuid(task_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("a2a_task_outputs")
            .insert(
                {
                    "task_id": task_id,
                    "artifact_type": artifact_type[:128],
                    "cid": cid,
                    "content_hash": content_hash,
                    "status": status[:32],
                }
            )
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_task_output failed: %s", e)
        return None


def list_task_outputs(task_id: str) -> list[dict[str, Any]]:
    if not db.is_uuid(task_id):
        return []
    client = db._client()
    if not client:
        return []
    try:
        r = (
            client.table("a2a_task_outputs")
            .select("*")
            .eq("task_id", task_id)
            .order("created_at", desc=True)
            .execute()
        )
        return list(r.data or [])
    except Exception as e:
        logger.warning("[registry_a2a] list_task_outputs failed: %s", e)
        return []


def suppress_nonfinal_outputs_for_failed_task(task_id: str) -> bool:
    """Do not promote pending/partial outputs when task fails."""
    if not db.is_uuid(task_id):
        return False
    client = db._client()
    if not client:
        return False
    try:
        for status in ("pending", "partial"):
            client.table("a2a_task_outputs").update({"status": "suppressed"}).eq(
                "task_id", task_id
            ).eq("status", status).execute()
        return True
    except Exception as e:
        logger.warning(
            "[registry_a2a] suppress_nonfinal_outputs_for_failed_task failed: %s", e
        )
        return False


def insert_checkpoint(
    task_id: str, checkpoint_cid: str | None, state_type: str | None
) -> dict[str, Any] | None:
    if not db.is_uuid(task_id):
        return None
    client = db._client()
    if not client:
        return None
    try:
        r = (
            client.table("a2a_checkpoints")
            .insert(
                {
                    "task_id": task_id,
                    "checkpoint_cid": checkpoint_cid,
                    "state_type": (state_type or "")[:64] or None,
                }
            )
            .execute()
        )
        return r.data[0] if r.data else None
    except Exception as e:
        logger.warning("[registry_a2a] insert_checkpoint failed: %s", e)
        return None


def latest_reputation_score(agent_id: str) -> float | None:
    rows = list_reputations(agent_id, limit=1)
    if not rows:
        return None
    try:
        return float(rows[0].get("score", 0))
    except (TypeError, ValueError):
        return None
