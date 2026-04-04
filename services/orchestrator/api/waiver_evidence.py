"""POST/GET signed waiver evidence for security findings (HMAC or Ed25519 placeholder)."""

from __future__ import annotations

import logging
import os
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

import db
from api.common import assert_workflow_owner, get_caller_id
from security.audit_stream import emit_security_audit_v1
from security.waiver_crypto import payload_sha256, verify_hmac_sha256
from store import get_workflow

logger = logging.getLogger(__name__)

waiver_evidence_router = APIRouter(prefix="/api/v1/runs", tags=["runs", "security"])


class WaiverSubmitBody(BaseModel):
    finding_id: str = Field(..., min_length=1, max_length=512)
    canonical_payload: dict[str, Any]
    signature_algorithm: Literal["hmac-sha256", "ed25519"]
    signature: str = Field(..., min_length=1, max_length=2048)
    approver_id: str = Field(..., min_length=32, max_length=64)
    signer_public_key: str | None = None


@waiver_evidence_router.post("/{run_id}/security-waivers")
def submit_security_waiver(
    run_id: str,
    body: WaiverSubmitBody,
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Store human-signed waiver evidence; link evidence id from finding waiver metadata."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    assert_workflow_owner(w, request)
    caller = get_caller_id(request) or (x_user_id or "").strip()
    if not caller:
        raise HTTPException(status_code=401, detail="Authenticated user required")
    if body.approver_id.strip() != caller.strip():
        raise HTTPException(
            status_code=403, detail="approver_id must match authenticated user"
        )
    if body.signature_algorithm == "ed25519":
        raise HTTPException(
            status_code=501,
            detail="ed25519 verification is not enabled in this server build",
        )
    secret = (os.environ.get("WAIVER_SIGNING_SECRET") or "").strip()
    if not secret:
        raise HTTPException(
            status_code=503,
            detail="WAIVER_SIGNING_SECRET is not configured",
        )
    if not verify_hmac_sha256(secret, body.canonical_payload, body.signature):
        raise HTTPException(status_code=400, detail="Invalid HMAC signature")
    ph = payload_sha256(body.canonical_payload)
    row = db.insert_waiver_evidence_row(
        run_id=run_id,
        finding_id=body.finding_id,
        canonical_payload=body.canonical_payload,
        payload_hash=ph,
        signature_algorithm=body.signature_algorithm,
        signature=body.signature.strip(),
        approver_id=body.approver_id,
        signer_public_key=body.signer_public_key,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to store waiver evidence")
    eid = str(row.get("id", ""))
    emit_security_audit_v1(
        event_type="waiver_evidence_stored",
        event_category="waiver",
        run_id=run_id,
        user_id=caller,
        request_id=None,
        severity="warning",
        payload={
            "evidence_id": eid,
            "finding_id": body.finding_id,
            "approver_id": body.approver_id,
            "payload_hash": ph,
        },
    )
    return {
        "evidence_record_id": eid,
        "run_id": run_id,
        "finding_id": body.finding_id,
        "payload_hash": ph,
    }


@waiver_evidence_router.get("/{run_id}/security-waivers")
def list_security_waivers(
    run_id: str,
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """List stored waiver evidence rows for a run (owner only)."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    assert_workflow_owner(w, request)
    items = db.list_waiver_evidence_for_run(run_id)
    return {"run_id": run_id, "items": items}
