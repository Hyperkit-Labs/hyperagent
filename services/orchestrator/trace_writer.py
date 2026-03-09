"""
Trace writer: build AgentTraceBlob-shaped payload, pin to IPFS when configured.
Returns real CID as blob_id when IPFS configured; otherwise stub for run_steps.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


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
    try:
        from ipfs_client import is_configured, pin_json

        if is_configured():
            name = f"trace/{run_id}/{step_type}/{step_index}.json"
            cid = await pin_json(
                payload, name, {"run_id": run_id, "step_type": step_type}
            )
            if cid:
                return cid, None, None
    except Exception as e:
        logger.warning("[trace_writer] IPFS pin failed: %s", e)
    return _stub_trace_id(run_id, step_type, step_index), None, None


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
    except Exception as e:
        logger.warning("[trace_writer] write_trace_sync failed: %s", e)
        return _stub_trace_id(run_id, step_type, step_index), None, None


def _stub_trace_id(run_id: str, step_type: str, step_index: int) -> str:
    """Deterministic stub blob_id when IPFS not configured."""
    return f"stub:{run_id}:{step_type}:{step_index}"
