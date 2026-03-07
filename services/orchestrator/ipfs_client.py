"""IPFS/Pinata artifact pinning. Pins specs, audit reports, code, and ABIs after pipeline stages.
Set STORAGE_SERVICE_URL (default http://localhost:4005) to enable. No-op when unconfigured."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

STORAGE_SERVICE_URL = os.environ.get("STORAGE_SERVICE_URL", "http://localhost:4005").rstrip("/")
IPFS_TIMEOUT = float(os.environ.get("IPFS_TIMEOUT_SEC", "15"))


def is_configured() -> bool:
    return bool(STORAGE_SERVICE_URL and STORAGE_SERVICE_URL != "http://localhost:4005") or bool(os.environ.get("IPFS_ENABLED"))


async def pin_json(data: dict | list | str, name: str, metadata: dict[str, str] | None = None) -> str | None:
    """Pin JSON data to IPFS via the storage service. Returns CID or None on failure."""
    if not is_configured():
        return None
    content = data if isinstance(data, str) else json.dumps(data, default=str)
    try:
        async with httpx.AsyncClient(timeout=IPFS_TIMEOUT) as client:
            r = await client.post(
                f"{STORAGE_SERVICE_URL}/ipfs/pin",
                json={
                    "content": content,
                    "name": name,
                    "metadata": metadata or {},
                },
            )
            r.raise_for_status()
            result = r.json()
            cid = result.get("cid") or result.get("IpfsHash") or result.get("ipfs_hash")
            if cid:
                logger.info("[ipfs] pinned %s → %s", name, cid)
            return cid
    except Exception as e:
        logger.warning("[ipfs] pin_json failed for %s: %s", name, e)
        return None


async def pin_artifact(run_id: str, stage: str, data: Any) -> str | None:
    """Pin a pipeline artifact (spec, audit, contracts, etc.) to IPFS. Returns CID."""
    name = f"hyperagent/{run_id}/{stage}.json"
    metadata = {"run_id": run_id, "stage": stage}
    return await pin_json(data, name, metadata)


async def record_storage(run_id: str, stage: str, cid: str) -> None:
    """Record IPFS CID in Supabase storage_records table.
    Uses run_id, artifact_type, storage_type, cid, gateway_url (schema-aligned)."""
    import db
    if not db.is_configured() or not cid:
        return
    try:
        client = db._client()
        if client:
            gateway_url = f"https://gateway.pinata.cloud/ipfs/{cid}"
            client.table("storage_records").insert({
                "run_id": run_id,
                "artifact_type": stage,
                "storage_type": "ipfs",
                "cid": cid,
                "gateway_url": gateway_url,
                "status": "pinned",
            }).execute()
    except Exception as e:
        logger.warning("[ipfs] record_storage failed: %s", e)
