"""
MLflow experiment tracking for the HyperAgent pipeline.

Tracks per-pipeline-run experiments:
  - Model routing decisions (provider, model_id, stage)
  - Stage latencies (spec, audit, simulation, deploy)
  - Audit finding counts by severity
  - Simulation success/failure rates
  - Overall pipeline outcome (FINISHED / FAILED)

No-op when MLFLOW_TRACKING_URI is not set. All calls are fire-and-forget:
a failure to log to MLflow never fails the pipeline.

Set MLFLOW_TRACKING_URI to the MLflow server URL (e.g. http://localhost:5000
for local Grafana stack, or a managed MLflow instance). The experiment name is
configurable via MLFLOW_EXPERIMENT_NAME (default: "hyperagent_pipeline").
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import contextmanager
from typing import Any, Generator

logger = logging.getLogger(__name__)

_TRACKING_URI = os.environ.get("MLFLOW_TRACKING_URI", "").strip()
_EXPERIMENT_NAME = os.environ.get("MLFLOW_EXPERIMENT_NAME", "hyperagent_pipeline")
_ENABLED = bool(_TRACKING_URI)

# Active MLflow run handles: run_id (pipeline) → MLflow active_run
_active_runs: dict[str, Any] = {}


def _mlflow():
    """Lazy-import mlflow to avoid hard dependency when not configured."""
    import mlflow  # noqa: PLC0415

    return mlflow


def is_configured() -> bool:
    return _ENABLED


def start_pipeline_run(run_id: str, params: dict[str, Any] | None = None) -> None:
    """Start an MLflow run for this pipeline run_id.

    Call once at pipeline entry (before the first node). Subsequent calls to
    log_stage_metric / log_model_decision use run_id to look up the active run.
    """
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        mlflow.set_tracking_uri(_TRACKING_URI)
        mlflow.set_experiment(_EXPERIMENT_NAME)
        active = mlflow.start_run(run_name=run_id)
        _active_runs[run_id] = active
        if params:
            mlflow.log_params({k: str(v)[:250] for k, v in params.items()})
        mlflow.log_param("pipeline_run_id", run_id)
    except Exception as exc:
        logger.warning(
            "[mlflow] start_pipeline_run failed for run_id=%s: %s", run_id, exc
        )


def end_pipeline_run(
    run_id: str,
    *,
    success: bool,
    final_stage: str = "",
    error: str | None = None,
) -> None:
    """End the MLflow run for this pipeline run. Call after pipeline completes or fails."""
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        if run_id in _active_runs:
            with mlflow.start_run(run_id=_active_runs[run_id].info.run_id):
                mlflow.log_param(
                    "final_stage", final_stage[:250] if final_stage else "unknown"
                )
                mlflow.log_metric("pipeline_success", 1 if success else 0)
                if error:
                    mlflow.set_tag("pipeline_error", error[:500])
            status = "FINISHED" if success else "FAILED"
            mlflow.end_run(status=status)
            _active_runs.pop(run_id, None)
    except Exception as exc:
        logger.warning(
            "[mlflow] end_pipeline_run failed for run_id=%s: %s", run_id, exc
        )


def log_model_decision(
    run_id: str,
    *,
    stage: str,
    provider: str,
    model_id: str,
    routing_hint: str = "",
    prompt_tokens: int = 0,
) -> None:
    """Log which model was selected for a pipeline stage.

    This is the core of MLflow-based model routing experiments:
    aggregate by provider/model to see which choices yield best audit pass rates.
    """
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        active = _active_runs.get(run_id)
        if not active:
            return
        with mlflow.start_run(run_id=active.info.run_id):
            mlflow.log_param(f"model_{stage}_provider", provider[:64])
            mlflow.log_param(f"model_{stage}_id", model_id[:64])
            if routing_hint:
                mlflow.log_param(f"model_{stage}_hint", routing_hint[:32])
            if prompt_tokens > 0:
                mlflow.log_metric(f"tokens_{stage}_prompt", prompt_tokens)
    except Exception as exc:
        logger.warning(
            "[mlflow] log_model_decision failed run_id=%s stage=%s: %s",
            run_id,
            stage,
            exc,
        )


def log_stage_metric(
    run_id: str,
    *,
    stage: str,
    latency_ms: float,
    success: bool,
    extra: dict[str, float | int] | None = None,
) -> None:
    """Log latency and success for a pipeline stage."""
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        active = _active_runs.get(run_id)
        if not active:
            return
        with mlflow.start_run(run_id=active.info.run_id):
            mlflow.log_metric(f"latency_ms_{stage}", latency_ms)
            mlflow.log_metric(f"success_{stage}", 1 if success else 0)
            if extra:
                for k, v in extra.items():
                    mlflow.log_metric(f"{stage}_{k}", float(v))
    except Exception as exc:
        logger.warning(
            "[mlflow] log_stage_metric failed run_id=%s stage=%s: %s",
            run_id,
            stage,
            exc,
        )


def log_audit_findings(
    run_id: str,
    findings: list[dict[str, Any]],
    *,
    audit_passed: bool,
) -> None:
    """Log audit finding counts by severity. Core feedback metric for codegen model routing."""
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        active = _active_runs.get(run_id)
        if not active:
            return
        severities = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "informational": 0,
        }
        for f in findings:
            sev = (f.get("severity") or "informational").lower()
            if sev in severities:
                severities[sev] += 1
            else:
                severities["informational"] += 1
        with mlflow.start_run(run_id=active.info.run_id):
            mlflow.log_metric("audit_passed", 1 if audit_passed else 0)
            mlflow.log_metric("audit_findings_total", len(findings))
            for sev, count in severities.items():
                mlflow.log_metric(f"audit_findings_{sev}", count)
    except Exception as exc:
        logger.warning("[mlflow] log_audit_findings failed run_id=%s: %s", run_id, exc)


def log_simulation_result(
    run_id: str,
    *,
    chain_id: int | str,
    simulation_passed: bool,
    gas_used: int = 0,
    rpc_fallback: bool = False,
) -> None:
    """Log simulation outcome. Tracks which chains need fallback and gas cost distribution."""
    if not _ENABLED:
        return
    try:
        mlflow = _mlflow()
        active = _active_runs.get(run_id)
        if not active:
            return
        with mlflow.start_run(run_id=active.info.run_id):
            mlflow.log_metric("simulation_passed", 1 if simulation_passed else 0)
            mlflow.log_metric("simulation_gas_used", gas_used)
            mlflow.log_param("simulation_chain_id", str(chain_id)[:32])
            mlflow.log_param("simulation_rpc_fallback", "1" if rpc_fallback else "0")
    except Exception as exc:
        logger.warning(
            "[mlflow] log_simulation_result failed run_id=%s: %s", run_id, exc
        )


@contextmanager
def stage_timer(run_id: str, stage: str) -> Generator[None, None, None]:
    """Context manager that times a pipeline stage and logs it to MLflow.

    Usage:
        async with stage_timer(run_id, "audit"):
            findings = await run_security_audits(...)
    """
    t0 = time.monotonic()
    success = True
    try:
        yield
    except Exception:
        success = False
        raise
    finally:
        elapsed_ms = (time.monotonic() - t0) * 1000
        log_stage_metric(run_id, stage=stage, latency_ms=elapsed_ms, success=success)
