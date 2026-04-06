"""
Filecoin archival via Lighthouse Filecoin First: register an existing IPFS CID for miner deals,
then track deal status via Lighthouse API.

Docs: https://docs.lighthouse.storage/filecoin-first/usage
Deal status: https://docs.lighthouse.storage/how-to/check-for-filecoin-deals

Requires LIGHTHOUSE_API_KEY and FILECOIN_ARCHIVAL_ENABLED=1.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import db
import httpx
import observability
from ipfs_client import STORAGE_STATUS_ARCHIVED

logger = logging.getLogger(__name__)

FILECOIN_ARCHIVAL_ENABLED = os.environ.get(
    "FILECOIN_ARCHIVAL", os.environ.get("FILECOIN_ARCHIVAL_ENABLED", "")
).strip().lower() in ("1", "true", "yes")
LIGHTHOUSE_API_KEY = (os.environ.get("LIGHTHOUSE_API_KEY") or "").strip()
FILECOIN_FIRST_BASE = os.environ.get(
    "FILECOIN_FIRST_BASE", "https://filecoin-first.lighthouse.storage"
).rstrip("/")
LIGHTHOUSE_API_BASE = os.environ.get(
    "LIGHTHOUSE_API_BASE", "https://api.lighthouse.storage"
).rstrip("/")

STORAGE_STATUS_DEAL_PENDING = "deal_pending"


def is_filecoin_archival_configured() -> bool:
    return bool(FILECOIN_ARCHIVAL_ENABLED and LIGHTHOUSE_API_KEY)


def should_mark_filecoin_archived(deal_payload: dict[str, Any]) -> bool:
    """True when Lighthouse reports at least one deal in a terminal or active state."""
    data = deal_payload.get("data")
    if not isinstance(data, list):
        return False
    for item in data:
        if not isinstance(item, dict):
            continue
        ds = str(item.get("dealStatus") or item.get("deal_status") or "").lower()
        if any(
            x in ds for x in ("active", "expired", "terminated", "slashed", "on-chain")
        ):
            return True
    return False


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {LIGHTHOUSE_API_KEY}"}


async def register_cid_filecoin_first(cid: str) -> dict[str, Any]:
    """POST/GET Lighthouse Filecoin First: register CID for Filecoin miner deals."""
    url = f"{FILECOIN_FIRST_BASE}/api/v1/pin/add_cid"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url, params={"cid": cid}, headers=_auth_headers())
        r.raise_for_status()
        if not r.content:
            return {}
        try:
            return r.json()
        except Exception:
            return {"raw": r.text[:2000]}


async def fetch_lighthouse_deal_status(cid: str) -> dict[str, Any]:
    """GET deal status from Lighthouse (aggregated Filecoin deal info)."""
    url = f"{LIGHTHOUSE_API_BASE}/api/lighthouse/deal_status"
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(url, params={"cid": cid}, headers=_auth_headers())
        r.raise_for_status()
        if not r.content:
            return {}
        return r.json()


def fetch_lighthouse_deal_status_sync(cid: str) -> dict[str, Any]:
    """Sync variant for reconciliation thread (no running event loop)."""
    url = f"{LIGHTHOUSE_API_BASE}/api/lighthouse/deal_status"
    with httpx.Client(timeout=45.0) as client:
        r = client.get(url, params={"cid": cid}, headers=_auth_headers())
        r.raise_for_status()
        if not r.content:
            return {}
        return r.json()


def deal_status_summary_from_payload(deal_payload: dict[str, Any]) -> str:
    data = deal_payload.get("data")
    if isinstance(data, list) and data:
        first = data[0] if isinstance(data[0], dict) else {}
        return str(
            first.get("dealStatus")
            or first.get("deal_status")
            or first.get("status")
            or "unknown"
        )
    return "unknown"


async def insert_filecoin_storage_record(
    run_id: str,
    stage: str,
    cid: str,
    gateway_url: str,
    register_response: dict[str, Any],
) -> None:
    """Persist a storage_records row with storage_type=filecoin and deal metadata."""
    if not db.is_configured():
        return
    client = db._client()
    if not client:
        return
    deal_snapshot: dict[str, Any] = {}
    try:
        deal_snapshot = await fetch_lighthouse_deal_status(cid)
    except Exception as e:
        logger.debug("[filecoin] initial deal_status fetch skipped: %s", e)
    meta = {
        "source": "lighthouse_filecoin_first",
        "stage": stage,
        "register_response": register_response,
        "deal_status_snapshot": deal_snapshot,
        "deal_status_summary": deal_status_summary_from_payload(deal_snapshot),
    }
    status = STORAGE_STATUS_DEAL_PENDING
    if should_mark_filecoin_archived(deal_snapshot):
        status = STORAGE_STATUS_ARCHIVED
    row = {
        "record_type": "filecoin_deal",
        "key": f"{run_id}:{stage}:fc:{cid}",
        "metadata": meta,
        "run_id": run_id,
        "artifact_type": stage,
        "storage_type": "filecoin",
        "cid": cid,
        "gateway_url": gateway_url,
        "status": status,
    }
    try:
        client.table("storage_records").insert(row).execute()
        observability.inc_storage_filecoin_row_inserted()
    except Exception as e:
        observability.inc_storage_filecoin_row_insert_failed()
        logger.warning("[filecoin] insert_filecoin_storage_record failed: %s", e)


async def maybe_register_filecoin_after_ipfs(
    run_id: str,
    stage: str,
    cid: str,
    gateway_url: str,
) -> None:
    """After a successful IPFS storage_record, register CID with Filecoin First and insert filecoin row."""
    if not is_filecoin_archival_configured():
        return
    try:
        reg = await register_cid_filecoin_first(cid)
        observability.inc_storage_filecoin_register_success()
        await insert_filecoin_storage_record(run_id, stage, cid, gateway_url, reg)
    except Exception as e:
        observability.inc_storage_filecoin_register_failure()
        logger.warning("[filecoin] register_cid_filecoin_first failed: %s", e)
