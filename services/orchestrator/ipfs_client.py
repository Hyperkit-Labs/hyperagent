"""IPFS/Pinata artifact pinning via StorageProvider (providers.py).

What this module does: content-addressed pinning and recording a CID plus a gateway URL.
What it does not do: prove long-term durability, Filecoin deals, or Arweave archival.
A stored CID is a reference to content the pinning service accepted, not a proof of
permanent availability. EigenDA trace anchoring is handled in da_client/trace_writer, not here.

Set STORAGE_SERVICE_URL (non-default) or IPFS_ENABLED to enable. No-op when unconfigured.
Optional: STORAGE_VERIFY_RETRIEVAL (see _should_verify_retrieval) runs a HEAD check on the
gateway URL after record. STORAGE_VERIFY_STRICT=1 marks status failed when verification fails.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import observability

logger = logging.getLogger(__name__)

STORAGE_SERVICE_URL = os.environ.get(
    "STORAGE_SERVICE_URL", "http://localhost:4005"
).rstrip("/")

# Lifecycle for storage_records.status (honest state; not a full reconciliation worker).
STORAGE_STATUS_PENDING = "pending"
STORAGE_STATUS_PINNED = "pinned"
STORAGE_STATUS_RECONCILED = "reconciled"
STORAGE_STATUS_FAILED = "failed"
# Reserved for future archival flows; no Filecoin write path in this codebase yet.
STORAGE_STATUS_ARCHIVED = "archived"

# Only IPFS-style writes are implemented here. DB or docs may mention other labels; do not
# treat them as implemented backends until deal/orchestration code exists.
SUPPORTED_RECORD_STORAGE_TYPES = frozenset({"ipfs"})


def is_configured() -> bool:
    return bool(
        STORAGE_SERVICE_URL and STORAGE_SERVICE_URL != "http://localhost:4005"
    ) or bool(os.environ.get("IPFS_ENABLED"))


def canonical_ipfs_gateway_url(cid: str) -> str:
    """Single policy for public gateway URL: PINATA_GATEWAY_BASE or https://PINATA_GATEWAY_DOMAIN/ipfs/{cid}."""
    base = os.environ.get("PINATA_GATEWAY_BASE", "").strip()
    domain = os.environ.get("PINATA_GATEWAY_DOMAIN", "gateway.pinata.cloud").strip()
    if base:
        return f"{base.rstrip('/')}/{cid}"
    return f"https://{domain}/ipfs/{cid}"


def _verify_gateway_retrieval_sync(gateway_url: str, timeout_sec: float = 8.0) -> bool:
    """Best-effort HTTP HEAD (fallback GET) to confirm the gateway responds for this URL."""
    try:
        import httpx

        with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
            r = client.head(gateway_url)
            if r.status_code < 400:
                return True
            if r.status_code in (405, 501):
                r2 = client.get(gateway_url, headers={"Range": "bytes=0-0"})
                return r2.status_code < 400
            return False
    except Exception as e:
        logger.debug("[ipfs] gateway verification error for %s: %s", gateway_url, e)
        return False


def _should_verify_retrieval() -> bool:
    raw = (os.environ.get("STORAGE_VERIFY_RETRIEVAL") or "").strip().lower()
    if raw in ("1", "true", "yes"):
        return True
    if raw in ("0", "false", "no"):
        return False
    return (
        os.environ.get("NODE_ENV") == "production"
        or os.environ.get("ENV") == "production"
    )


def _verify_strict() -> bool:
    return (os.environ.get("STORAGE_VERIFY_STRICT") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


async def pin_json(
    data: dict | list | str, name: str, metadata: dict[str, str] | None = None
) -> str | None:
    """Pin JSON data to IPFS via StorageProvider. Returns CID or None on failure."""
    if not is_configured():
        return None
    content = data if isinstance(data, str) else json.dumps(data, default=str)
    try:
        from circuit_breaker import CircuitOpenError
        from providers import get_storage_provider

        provider = get_storage_provider()
        result = await provider.pin(content, name)
        cid = result.get("cid")
        if cid:
            logger.info("[ipfs] pinned %s → %s", name, cid)
            observability.inc_storage_ipfs_pin_success()
        else:
            observability.inc_storage_ipfs_pin_failure()
        return cid
    except CircuitOpenError:
        logger.warning("[ipfs] circuit open, skipping pin for %s", name)
        observability.inc_storage_ipfs_pin_failure()
        return None
    except Exception as e:
        logger.warning("[ipfs] pin_json failed for %s: %s", name, e)
        observability.inc_storage_ipfs_pin_failure()
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


async def pin_and_record(
    run_id: str,
    stage: str,
    data: Any,
    project_id: str | None = None,
) -> str | None:
    """Pin artifact to IPFS and record the CID in Supabase. One-call helper for pipeline nodes."""
    try:
        cid = await pin_artifact(run_id, stage, data)
        if cid:
            await record_storage(run_id, stage, cid, project_id=project_id)
        return cid
    except Exception as e:
        logger.warning("[ipfs] pin_and_record(%s/%s) failed: %s", run_id, stage, e)
        return None


def _resolve_storage_status(
    gateway_url: str, *, verify: bool, verified_ok: bool
) -> str:
    if not verify:
        return STORAGE_STATUS_PINNED
    if verified_ok:
        return STORAGE_STATUS_RECONCILED
    if _verify_strict():
        logger.warning(
            "[ipfs] strict retrieval verification failed (status=%s): %s",
            STORAGE_STATUS_FAILED,
            gateway_url,
        )
        return STORAGE_STATUS_FAILED
    logger.warning(
        "[ipfs] retrieval not verified; leaving status=%s: %s",
        STORAGE_STATUS_PINNED,
        gateway_url,
    )
    return STORAGE_STATUS_PINNED


async def record_storage(
    run_id: str,
    stage: str,
    cid: str,
    project_id: str | None = None,
) -> None:
    """Record IPFS CID in Supabase. Creates project_artifact when project_id given, then storage_record.

    Primary row uses ``storage_type=ipfs``. When FILECOIN_ARCHIVAL_ENABLED and LIGHTHOUSE_API_KEY are set,
    a follow-up registers the CID with Lighthouse Filecoin First and inserts ``storage_type=filecoin``.
    """
    import db

    if not db.is_configured() or not cid:
        return
    storage_type = "ipfs"
    if storage_type not in SUPPORTED_RECORD_STORAGE_TYPES:
        logger.error(
            "[ipfs] unsupported storage_type %r; skipping record", storage_type
        )
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
            gateway_url = canonical_ipfs_gateway_url(cid)
            verify = _should_verify_retrieval()
            verified_ok = False
            if verify:
                verified_ok = await asyncio.to_thread(
                    _verify_gateway_retrieval_sync, gateway_url
                )
            status = _resolve_storage_status(
                gateway_url, verify=verify, verified_ok=verified_ok
            )
            row = {
                "record_type": "ipfs_pin",
                "key": f"{run_id}:{stage}:{cid}",
                "metadata": {
                    "source": "orchestrator",
                    "stage": stage,
                    "verify_attempts": 0,
                },
                "run_id": run_id,
                "artifact_type": stage,
                "storage_type": storage_type,
                "cid": cid,
                "gateway_url": gateway_url,
                "status": status,
            }
            if artifact_id:
                row["artifact_id"] = artifact_id
            client.table("storage_records").insert(row).execute()
            observability.inc_storage_ipfs_record_insert_success()
            try:
                from filecoin_client import maybe_register_filecoin_after_ipfs

                await maybe_register_filecoin_after_ipfs(
                    run_id, stage, cid, gateway_url
                )
            except Exception as fc_err:
                logger.warning("[ipfs] Filecoin archival follow-up failed: %s", fc_err)
    except Exception as e:
        observability.inc_storage_ipfs_record_insert_failure()
        logger.warning("[ipfs] record_storage failed: %s", e)
