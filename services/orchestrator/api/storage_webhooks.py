"""Pinata (and compatible) webhooks: confirm pin events and reconcile storage_records."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

import db
import observability
from ipfs_client import STORAGE_STATUS_RECONCILED

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/storage/webhooks", tags=["storage"])


def _extract_cid(payload: dict[str, Any]) -> str | None:
    for key in ("cid", "ipfsHash", "IpfsHash", "hash"):
        v = payload.get(key)
        if isinstance(v, str) and v.startswith(("Qm", "baf")):
            return v
    for nested in ("data", "pin", "info"):
        block = payload.get(nested)
        if isinstance(block, dict):
            for key in ("cid", "ipfsPinHash", "IpfsHash", "hash"):
                v = block.get(key)
                if isinstance(v, str) and len(v) > 8:
                    return v
    return None


def _verify_pinata_signature(
    body: bytes, signature_header: str | None, secret: str
) -> bool:
    if not secret or not signature_header:
        return False
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    sig = signature_header.strip()
    if sig.lower().startswith("sha256="):
        sig = sig.split("=", 1)[1].strip()
    return hmac.compare_digest(digest, sig)


@router.post("/pinata")
async def pinata_pin_webhook(
    request: Request,
    x_pinata_signature: str | None = Header(None, alias="x-pinata-signature"),
    x_pinata_hmac_sha256: str | None = Header(None, alias="x-pinata-hmac-sha256"),
) -> dict[str, Any]:
    """
    Pinata sends pin completion events. Set PINATA_WEBHOOK_SECRET to the signing secret
    from the Pinata dashboard. Confirmed pins set matching storage_records to reconciled.
    """
    secret = (os.environ.get("PINATA_WEBHOOK_SECRET") or "").strip()
    body = await request.body()
    sig = x_pinata_signature or x_pinata_hmac_sha256
    if secret:
        if not _verify_pinata_signature(body, sig, secret):
            logger.warning("[storage_webhook] Pinata signature verification failed")
            observability.inc_storage_webhook_sig_fail()
            raise HTTPException(status_code=401, detail="invalid signature")
    elif (
        os.environ.get("ENVIRONMENT", "").lower() == "production"
        or os.environ.get("NODE_ENV", "").lower() == "production"
    ):
        raise HTTPException(
            status_code=503,
            detail="PINATA_WEBHOOK_SECRET must be set in production",
        )

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json body") from None

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="expected json object")

    cid = _extract_cid(payload)
    if not cid:
        logger.info("[storage_webhook] no cid in payload keys=%s", list(payload.keys()))
        return {"ok": True, "processed": False, "reason": "no_cid"}

    meta = {
        "webhook_confirmed": True,
        "webhook_event": payload.get("type") or payload.get("event"),
    }
    n = db.reconcile_storage_records_webhook(cid, STORAGE_STATUS_RECONCILED, meta)
    if n == 0:
        logger.warning("[storage_webhook] no rows updated for cid=%s", cid[:16])
    else:
        observability.inc_storage_webhook_ok()
    return {"ok": True, "processed": True, "cid": cid, "rows_updated": n}
