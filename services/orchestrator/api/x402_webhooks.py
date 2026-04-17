"""Inbound x402 facilitator webhooks: confirm or fail on-chain settlement."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import db
from fastapi import APIRouter, Header, HTTPException, Request
from webhook_utils import verify_hmac_sha256

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402", tags=["x402"])


def _production_env() -> bool:
    return (
        os.environ.get("ENVIRONMENT", "").lower() == "production"
        or os.environ.get("NODE_ENV", "").lower() == "production"
    )


@router.post("/settlement")
async def x402_settlement_webhook(
    request: Request,
    x_facilitator_signature: str | None = Header(None, alias="x-facilitator-signature"),
) -> dict[str, Any]:
    """Facilitator push: update payment_history for a proof nonce after settlement."""
    secret = (os.environ.get("X402_WEBHOOK_SECRET") or "").strip()
    body = await request.body()
    if secret:
        if not verify_hmac_sha256(body, x_facilitator_signature, secret):
            logger.warning("[x402_webhook] facilitator signature verification failed")
            raise HTTPException(status_code=401, detail="invalid signature")
    elif _production_env():
        raise HTTPException(
            status_code=503,
            detail="X402_WEBHOOK_SECRET must be set in production",
        )

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json body") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="expected json object")

    nonce = payload.get("nonce")
    if not nonce or not isinstance(nonce, str):
        raise HTTPException(status_code=400, detail="missing nonce")

    status = payload.get("status")
    if not isinstance(status, str):
        raise HTTPException(status_code=400, detail="missing status")

    n = db.update_x402_settlement(nonce, status, payload)
    return {"ok": True, "rows_updated": n}
