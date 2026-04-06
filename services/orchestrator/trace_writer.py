"""
Trace writer: build AgentTraceBlob-shaped payload, pin to IPFS when configured.
EigenDA (da_client) is only used to anchor trace blobs for provenance, not as bulk storage.

Returns real CID as blob_id when IPFS configured; otherwise stub for run_steps.
In production, stub mode is invalid; IPFS is required for verifiable provenance when storage is enforced.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

IS_PRODUCTION = (
    os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production"
)


def build_trace_payload(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a minimal AgentTraceBlob v1-shaped payload for this step (no large blobs in Postgres).
    Includes ERC-8004 agent identity when available for provenance."""
    payload: dict[str, Any] = {
        "version": "1",
        "run_id": run_id,
        "step_type": step_type,
        "step_index": step_index,
        "status": status,
        "output_summary": (output_summary or "")[:1024],
        "error_message": (error_message or "")[:512] if error_message else None,
    }
    try:
        from registries import get_erc8004_agent_identity

        identity = get_erc8004_agent_identity()
        if identity:
            payload["agent"] = identity
    except Exception:
        pass
    if extra:
        payload.update(extra)
    return payload


async def write_trace(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> tuple[str | None, str | None, str | None]:
    """
    Pin trace payload to IPFS when configured; return (blob_id, da_cert, reference_block).
    blob_id: IPFS CID when pinned, else stub. Caller stores in run_steps via update_step.
    extra: optional dict merged into payload (e.g. discussion_trace for debate steps).
    """
    payload = build_trace_payload(
        run_id, step_type, step_index, status, output_summary, error_message, extra
    )
    import json

    payload_str = json.dumps(payload, default=str)
    blob_id = _stub_trace_id(run_id, step_type, step_index)
    da_cert, ref_block = None, None

    try:
        from ipfs_client import is_configured, pin_json

        if is_configured():
            name = f"trace/{run_id}/{step_type}/{step_index}.json"
            cid = await pin_json(
                payload, name, {"run_id": run_id, "step_type": step_type}
            )
            if cid:
                blob_id = cid
    except Exception as e:
        logger.warning("[trace_writer] IPFS pin failed: %s", e)

    try:
        from da_client import is_configured as da_ok, submit_blob

        if da_ok():
            da_cert, ref_block = await submit_blob(blob_id, payload_str)
    except RuntimeError:
        raise
    except Exception as da_err:
        logger.debug("[trace_writer] EigenDA submit skipped: %s", da_err)

    if IS_PRODUCTION:
        from da_client import is_configured as da_ok

        if da_ok() and not (da_cert or ref_block):
            raise RuntimeError(
                "EigenDA enabled but trace produced no DA cert or reference block"
            ) from None
        if blob_id.startswith("stub:"):
            raise RuntimeError(
                "IPFS/Storage Provider unavailable. Verifiable trace is mandatory in production."
            ) from None
    return blob_id, da_cert, ref_block


def write_trace_sync(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> tuple[str | None, str | None, str | None]:
    """Synchronous wrapper for write_trace. Runs async in event loop."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as pool:
                fut = pool.submit(
                    asyncio.run,
                    write_trace(
                        run_id,
                        step_type,
                        step_index,
                        status,
                        output_summary,
                        error_message,
                        extra,
                    ),
                )
                return fut.result(timeout=15)
        else:
            return loop.run_until_complete(
                write_trace(
                    run_id,
                    step_type,
                    step_index,
                    status,
                    output_summary,
                    error_message,
                    extra,
                )
            )
    except RuntimeError:
        raise
    except Exception as e:
        logger.warning("[trace_writer] write_trace_sync failed: %s", e)
        if IS_PRODUCTION:
            raise RuntimeError(
                "Trace write failed in production. Stub traces are not allowed."
            ) from e
        return _stub_trace_id(run_id, step_type, step_index), None, None


def _stub_trace_id(run_id: str, step_type: str, step_index: int) -> str:
    """Deterministic stub blob_id when IPFS not configured."""
    return f"stub:{run_id}:{step_type}:{step_index}"
