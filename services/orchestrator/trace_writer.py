"""
EigenDA trace writer: build AgentTraceBlob-shaped payload, submit to DA when configured, return blob_id for run_steps.
Registry-driven: da_backend from orchestrator.yaml (or DA_BACKEND env); when eigenda and EIGENDA_API_URL set, POST.
Single place for verifiable trace emission. Thin adapter: config in, call API, return result.
"""
from __future__ import annotations

import os
from typing import Any

# See .cursor/llm/docs/eigenda-llm.txt for AgentTraceBlob v1 design.


def _eigenda_enabled() -> bool:
    """True when registry says da_backend=eigenda and EIGENDA_API_URL is set."""
    try:
        from registries import get_da_backend
        if get_da_backend() != "eigenda":
            return False
    except Exception:
        return False
    url = os.environ.get("EIGENDA_API_URL", "").strip()
    return bool(url)


def _eigenda_api_url() -> str:
    return (os.environ.get("EIGENDA_API_URL") or "").rstrip("/")


def build_trace_payload(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a minimal AgentTraceBlob v1–shaped payload for this step (no large blobs in Postgres)."""
    return {
        "version": "1",
        "run_id": run_id,
        "step_type": step_type,
        "step_index": step_index,
        "status": status,
        "output_summary": (output_summary or "")[:1024],
        "error_message": (error_message or "")[:512] if error_message else None,
        **(extra or {}),
    }


def write_trace(
    run_id: str,
    step_type: str,
    step_index: int,
    status: str,
    output_summary: str | None = None,
    error_message: str | None = None,
) -> tuple[str | None, str | None, str | None]:
    """
    Emit trace for this step. When registry da_backend=eigenda and EIGENDA_API_URL set, POST payload and return (blob_id, da_cert, reference_block).
    When EigenDA is disabled, return a stub blob_id so run_steps always get trace_blob_id (storage policy applied).
    When EigenDA is enabled but the write fails, do not break the pipeline; leave blob fields null by returning (None, None, None).
    Caller stores blob_id in run_steps via update_step.
    """
    payload = build_trace_payload(run_id, step_type, step_index, status, output_summary, error_message)
    if _eigenda_enabled():
        base = _eigenda_api_url()
        if not base:
            return (None, None, None)
        try:
            import httpx  # type: ignore[import-not-found]
            r = httpx.post(
                f"{base}/blob",
                json=payload,
                timeout=10.0,
            )
            if r.status_code == 200:
                data = r.json()
                blob_id = data.get("blob_id") or data.get("id")
                da_cert = data.get("da_cert")
                ref_block = data.get("reference_block")
                return (str(blob_id) if blob_id else None, da_cert, ref_block)
        except Exception:
            # EigenDA failure should not break the main pipeline; leave blob fields null and log.
            try:
                from logging import getLogger
                getLogger(__name__).warning("EigenDA trace write failed for run_id=%s step_type=%s", run_id, step_type)
            except Exception:
                pass
            return (None, None, None)
        return (None, None, None)
    stub_id = _stub_trace_id(run_id, step_type, step_index)
    try:
        from logging import getLogger
        getLogger(__name__).info("trace_stub_mode run_id=%s step_type=%s step_index=%s blob_id=%s", run_id, step_type, step_index, stub_id)
    except Exception:
        pass
    return stub_id, None, None


def _stub_trace_id(run_id: str, step_type: str, step_index: int) -> str:
    """Deterministic stub blob_id when EigenDA is not used; ensures run_steps.trace_blob_id is always set."""
    return f"stub:{run_id}:{step_type}:{step_index}"
