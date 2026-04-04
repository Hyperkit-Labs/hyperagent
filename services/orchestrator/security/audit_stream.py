"""Central security audit stream: structured logs + Supabase security_audit_log (v1)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def emit_security_audit_v1(
    *,
    event_type: str,
    event_category: str,
    service: str = "orchestrator",
    run_id: str | None = None,
    user_id: str | None = None,
    request_id: str | None = None,
    severity: str = "info",
    payload: dict[str, Any] | None = None,
) -> None:
    """Emit one security audit event (stdout JSON + optional DB row)."""
    body = {
        "schema_version": "security_audit_v1",
        "service": service,
        "event_category": event_category,
        "event_type": event_type,
        "severity": severity,
        "run_id": run_id,
        "user_id": user_id,
        "request_id": request_id,
        "payload": payload or {},
    }
    logger.info(
        "%s",
        json.dumps({"audit": True, **{k: v for k, v in body.items() if v is not None}}),
    )
    if os.environ.get("SUPABASE_AUDIT_DISABLE", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return
    try:
        import db

        if not db.is_configured():
            return
        db.insert_security_audit_event_v1(
            event_type=event_type,
            service=service,
            event_category=event_category,
            event_data={"payload": payload or {}, "schema_version": "security_audit_v1"},
            run_id=run_id,
            user_id=user_id,
            request_id=request_id,
            severity=severity,
        )
    except Exception as e:
        logger.debug("[audit_stream] db insert skipped: %s", e)
