"""Inbound simulation provider webhooks (e.g. Tenderly alerts)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import db
from fastapi import APIRouter, Header, HTTPException, Request
from webhook_utils import verify_hmac_sha256

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/simulation/webhooks", tags=["simulation"])


def _production_env() -> bool:
    return (
        os.environ.get("ENVIRONMENT", "").lower() == "production"
        or os.environ.get("NODE_ENV", "").lower() == "production"
    )


@router.post("/tenderly")
async def tenderly_alert_webhook(
    request: Request,
    x_tenderly_signature: str | None = Header(None, alias="x-tenderly-signature"),
) -> dict[str, Any]:
    """Tenderly push: merge alert payload into simulations.results and set status."""
    secret = (os.environ.get("TENDERLY_WEBHOOK_SECRET") or "").strip()
    body = await request.body()
    if secret:
        if not verify_hmac_sha256(body, x_tenderly_signature, secret):
            logger.warning(
                "[simulation_webhook] Tenderly signature verification failed"
            )
            raise HTTPException(status_code=401, detail="invalid signature")
    elif _production_env():
        raise HTTPException(
            status_code=503,
            detail="TENDERLY_WEBHOOK_SECRET must be set in production",
        )

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json body") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="expected json object")

    simulation_id = payload.get("simulation_id")
    if not simulation_id or not isinstance(simulation_id, str):
        raise HTTPException(status_code=400, detail="missing simulation_id")

    status = payload.get("status")
    if not isinstance(status, str):
        raise HTTPException(status_code=400, detail="missing status")

    n = db.update_simulation_result(simulation_id, status, payload)
    return {"ok": True, "rows_updated": n}
