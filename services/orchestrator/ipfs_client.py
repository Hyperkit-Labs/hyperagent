"""IPFS/Pinata artifact pinning. Pins specs, audit reports, code, and ABIs after pipeline stages.
Set STORAGE_SERVICE_URL (default http://localhost:4005) to enable. No-op when unconfigured."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

STORAGE_SERVICE_URL = os.environ.get(
    "STORAGE_SERVICE_URL", "http://localhost:4005"
).rstrip("/")
IPFS_TIMEOUT = float(os.environ.get("IPFS_TIMEOUT_SEC", "15"))


def is_configured() -> bool:
    return bool(
        STORAGE_SERVICE_URL and STORAGE_SERVICE_URL != "http://localhost:4005"
    ) or bool(os.environ.get("IPFS_ENABLED"))


async def _do_pin_json(
    content: str, name: str, metadata: dict[str, str] | None
) -> str | None:
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
        return result.get("cid") or result.get("IpfsHash") or result.get("ipfs_hash")


async def pin_json(
    data: dict | list | str, name: str, metadata: dict[str, str] | None = None
) -> str | None:
    """Pin JSON data to IPFS via the storage service. Returns CID or None on failure."""
    if not is_configured():
        return None
    content = data if isinstance(data, str) else json.dumps(data, default=str)
    try:
        from circuit_breaker import CircuitOpenError, get_breaker

        breaker = get_breaker("ipfs")
        cid = await breaker.call(_do_pin_json, content, name, metadata)
        if cid:
            logger.info("[ipfs] pinned %s → %s", name, cid)
        return cid
    except CircuitOpenError:
        logger.warning("[ipfs] circuit open, skipping pin for %s", name)
        return None
    except Exception as e:
        logger.warning("[ipfs] pin_json failed for %s: %s", name, e)
        return None


async def pin_artifact(run_id: str, stage: str, data: Any) -> str | None:
    """Pin a pipeline artifact (spec, audit, contracts, etc.) to IPFS. Returns CID."""
    name = f"hyperagent/{run_id}/{stage}.json"
    metadata = {"run_id": run_id, "stage": stage}
    return await pin_json(data, name, metadata)


_STAGE_TO_ARTIFACT_TYPE: dict[str, str] = {
    "spec": "spec",
    "design": "design_doc",
    "code": "contract",
    "contracts": "contract",
    "audit": "audit_report",
    "simulation": "simulation_report",
    "deploy": "deployment_record",
}


async def record_storage(
    run_id: str,
    stage: str,
    cid: str,
    project_id: str | None = None,
) -> None:
    """Record IPFS CID in Supabase. Creates project_artifact when project_id given, then storage_record with artifact_id."""
    import db

    if not db.is_configured() or not cid:
        return
    try:
        artifact_id = None
        if project_id and db.is_uuid(project_id):
            artifact_type = _STAGE_TO_ARTIFACT_TYPE.get(stage, stage)
            name = f"{stage}-{run_id[:8]}.json"
            artifact_id = db.insert_project_artifact(
                project_id=project_id,
                run_id=run_id,
                artifact_type=artifact_type,
                name=name,
                content=None,
                ipfs_cid=cid,
                metadata={"stage": stage},
            )
        client = db._client()
        if client:
            gateway_base = os.environ.get("PINATA_GATEWAY_BASE", "").strip()
            gateway_domain = os.environ.get("PINATA_GATEWAY_DOMAIN", "gateway.pinata.cloud").strip()
            gateway_url = (
                f"{gateway_base.rstrip('/')}/{cid}"
                if gateway_base
                else f"https://{gateway_domain}/ipfs/{cid}"
            )
            row = {
                "run_id": run_id,
                "artifact_type": stage,
                "storage_type": "ipfs",
                "cid": cid,
                "gateway_url": gateway_url,
                "status": "pinned",
            }
            if artifact_id:
                row["artifact_id"] = artifact_id
            client.table("storage_records").insert(row).execute()
    except Exception as e:
        logger.warning("[ipfs] record_storage failed: %s", e)
