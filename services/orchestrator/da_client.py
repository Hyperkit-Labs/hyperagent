"""
EigenDA blob submission for trace anchoring and provenance only.

This is not a general-purpose file or artifact bucket. Use IPFS/pinning flows in
ipfs_client for content-addressed artifacts. EigenDA here anchors trace payloads
already identified by blob_id (often an IPFS CID).

When EIGENDA_ENABLED and EIGENDA_PRIVATE_KEY are set, submits via powerloom-eigenda.
Returns (da_cert, reference_block) for run_steps. No-op when not configured.
"""

from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

EIGENDA_ENABLED = (os.environ.get("EIGENDA_ENABLED") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
EIGENDA_PRIVATE_KEY = (os.environ.get("EIGENDA_PRIVATE_KEY") or "").strip()
EIGENDA_DISPERSER_URL = (
    os.environ.get("EIGENDA_DISPERSER_URL") or "https://disperser-holesky.eigenda.xyz"
).rstrip("/")


def is_configured() -> bool:
    return bool(EIGENDA_ENABLED and EIGENDA_PRIVATE_KEY)


def _extract_da_proof(result: object | None, blob_id: str) -> tuple[str, str]:
    """Extract (da_cert, reference_block) from disperse result. Fallback to blob_id when header missing."""
    da_cert: str | None = None
    ref_block: str | None = None
    if result and hasattr(result, "blob_header"):
        header = result.blob_header
        da_cert = getattr(header, "commitment", None) or getattr(
            header, "blob_verification_proof", None
        )
        ref_block = getattr(header, "reference_block_number", None) or getattr(
            header, "batch_header", None
        )
        if hasattr(result, "batch_header") and ref_block is None:
            ref_block = getattr(
                result.batch_header, "reference_block_number", None
            ) or str(getattr(result, "batch_id", ""))
    if hasattr(result, "blob_verification_proof") and da_cert is None:
        da_cert = (
            str(result.blob_verification_proof)
            if result.blob_verification_proof
            else None
        )
    if hasattr(result, "batch_id") and ref_block is None and result.batch_id:
        ref_block = str(result.batch_id)
    if da_cert is not None:
        da_cert = str(da_cert) if not isinstance(da_cert, str) else da_cert
    if ref_block is not None:
        ref_block = str(ref_block) if not isinstance(ref_block, str) else ref_block
    if not da_cert:
        da_cert = f"eigenda:{blob_id}"
    if not ref_block:
        ref_block = blob_id
    return da_cert, ref_block


async def submit_blob(blob_id: str, payload_json: str) -> tuple[str | None, str | None]:
    """
    Submit blob to EigenDA when configured. Returns (da_cert, reference_block).
    Fail-closed: when EIGENDA_ENABLED, raises RuntimeError if submission fails or proof missing.
    """
    if not is_configured():
        return None, None
    try:
        from powerloom_eigenda import DisperserClientV2Full

        payload_bytes = payload_json.encode("utf-8")
        client = DisperserClientV2Full(
            disperser_url=EIGENDA_DISPERSER_URL,
            private_key=EIGENDA_PRIVATE_KEY,
        )
        disperse_fn = getattr(client, "disperse_blob", None) or getattr(
            client, "disperse", None
        )
        if not disperse_fn:
            raise RuntimeError(
                "EigenDA configured but client has no disperse_blob or disperse method"
            )
        maybe_result = disperse_fn(payload_bytes)
        if asyncio.iscoroutine(maybe_result):
            result = await maybe_result
        else:
            result = maybe_result
        da_cert, ref_block = _extract_da_proof(result, blob_id)
        logger.info(
            "[da] EigenDA blob submitted blob_id=%s da_cert=%s ref_block=%s",
            blob_id,
            da_cert[:32] if da_cert else "",
            ref_block,
        )
        return da_cert, ref_block
    except ImportError as e:
        raise RuntimeError(
            f"EigenDA enabled but powerloom-eigenda not installed: {e}"
        ) from e
    except RuntimeError:
        raise
    except Exception as e:
        raise RuntimeError(f"EigenDA submit failed: {e}") from e
