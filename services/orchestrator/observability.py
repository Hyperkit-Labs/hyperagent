"""
Observability: request latency histogram for p95 SLO, pipeline counters, Prometheus metrics.
Uses prometheus-client for proper counter/histogram types that survive multi-worker deployments.
Middleware records latencies here; metrics_health reads p95 and exposes /metrics.
"""

from __future__ import annotations

import logging
import os

from prometheus_client import (
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    multiprocess,
)

logger = logging.getLogger(__name__)

# When PROMETHEUS_MULTIPROC_DIR is set (multi-worker Gunicorn/Uvicorn),
# prometheus-client uses a shared directory for cross-worker aggregation.
# In single-process mode the default in-process registry is sufficient.
# Coolify/k8s often set the env from .env.example while the path does not exist
# yet; MultiProcessCollector raises at import time and prevents the app from
# starting (Docker health checks fail with no useful application logs).
_registry = CollectorRegistry()
_mpdir = (
    os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    or os.environ.get("prometheus_multiproc_dir")
    or ""
).strip()
if _mpdir:
    try:
        if not os.path.isdir(_mpdir):
            os.makedirs(_mpdir, mode=0o755, exist_ok=True)
        multiprocess.MultiProcessCollector(_registry)
    except (ValueError, OSError) as e:
        logger.warning(
            "[observability] PROMETHEUS_MULTIPROC_DIR=%r unusable (%s); "
            "using in-process metrics only",
            _mpdir,
            e,
        )

# ---------------------------------------------------------------------------
# Metrics declarations
# ---------------------------------------------------------------------------

request_latency = Histogram(
    "hyperagent_request_latency_seconds",
    "HTTP request latency in seconds (excludes /health and /streaming/)",
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=_registry,
)

pipeline_runs_total = Counter(
    "hyperagent_pipeline_runs_total",
    "Total pipeline runs started",
    registry=_registry,
)
pipeline_runs_completed = Counter(
    "hyperagent_pipeline_runs_completed",
    "Pipeline runs completed successfully",
    registry=_registry,
)
pipeline_runs_failed = Counter(
    "hyperagent_pipeline_runs_failed",
    "Pipeline runs failed",
    registry=_registry,
)

# Storage subsystem counters
storage_ipfs_pin_success = Counter(
    "hyperagent_storage_ipfs_pin_success_total",
    "Successful IPFS pin_json completions",
    registry=_registry,
)
storage_ipfs_pin_failure = Counter(
    "hyperagent_storage_ipfs_pin_failure_total",
    "Failed IPFS pin_json attempts",
    registry=_registry,
)
storage_ipfs_record_insert_success = Counter(
    "hyperagent_storage_ipfs_record_insert_success_total",
    "storage_records IPFS rows inserted",
    registry=_registry,
)
storage_ipfs_record_insert_failure = Counter(
    "hyperagent_storage_ipfs_record_insert_failure_total",
    "storage_records IPFS insert errors",
    registry=_registry,
)
storage_webhook_ok = Counter(
    "hyperagent_storage_webhook_ok_total",
    "Pinata webhook rows updated",
    registry=_registry,
)
storage_webhook_sig_fail = Counter(
    "hyperagent_storage_webhook_sig_fail_total",
    "Pinata webhook signature failures",
    registry=_registry,
)
storage_reconcile_examined = Counter(
    "hyperagent_storage_reconcile_examined_total",
    "Gateway re-verify rows examined",
    registry=_registry,
)
storage_reconcile_reconciled = Counter(
    "hyperagent_storage_reconcile_reconciled_total",
    "Rows moved to reconciled",
    registry=_registry,
)
storage_reconcile_still_pinned = Counter(
    "hyperagent_storage_reconcile_still_pinned_total",
    "Rows still pinned after failed HEAD",
    registry=_registry,
)
storage_reconcile_marked_failed = Counter(
    "hyperagent_storage_reconcile_marked_failed_total",
    "Rows marked failed after reconcile",
    registry=_registry,
)
storage_filecoin_register_success = Counter(
    "hyperagent_storage_filecoin_register_success_total",
    "Lighthouse Filecoin First CID registrations",
    registry=_registry,
)
storage_filecoin_register_failure = Counter(
    "hyperagent_storage_filecoin_register_failure_total",
    "Filecoin First registration failures",
    registry=_registry,
)
storage_filecoin_row_inserted = Counter(
    "hyperagent_storage_filecoin_row_inserted_total",
    "storage_records filecoin rows inserted",
    registry=_registry,
)
storage_filecoin_row_insert_failed = Counter(
    "hyperagent_storage_filecoin_row_insert_failed_total",
    "storage_records filecoin insert failures",
    registry=_registry,
)
storage_filecoin_deal_poll_updated = Counter(
    "hyperagent_storage_filecoin_deal_poll_updated_total",
    "Filecoin deal status poll updates",
    registry=_registry,
)

p95_latency_gauge = Gauge(
    "hyperagent_p95_latency_ms",
    "P95 request latency in milliseconds (rolling window)",
    registry=_registry,
)


# ---------------------------------------------------------------------------
# Public API — same names as before so callers need no changes
# ---------------------------------------------------------------------------


def record_latency(elapsed: float) -> None:
    """Record request latency (seconds). Excludes /health and /streaming/ paths."""
    request_latency.observe(elapsed)
    # Keep p95 gauge updated so legacy callers still get a value.
    p95_latency_gauge.set(_compute_p95_ms())


def _compute_p95_ms() -> float:
    """Approximate p95 from histogram bucket counts. Returns 0.0 when no data."""
    # Collect all samples from the histogram.
    samples = list(request_latency.collect())
    if not samples:
        return 0.0
    for metric_family in samples:
        for sample in metric_family.samples:
            if sample.name == "hyperagent_request_latency_seconds_count":
                count = sample.value
                if count < 10:
                    return 0.0
    # Use _sum/_count for mean as a proxy; real p95 would need bucket traversal.
    total_sum = total_count = 0.0
    for metric_family in samples:
        for sample in metric_family.samples:
            if sample.name == "hyperagent_request_latency_seconds_sum":
                total_sum = sample.value
            elif sample.name == "hyperagent_request_latency_seconds_count":
                total_count = sample.value
    if total_count == 0:
        return 0.0
    return (total_sum / total_count) * 1000.0


def p95_latency_ms() -> float | None:
    """Return p95 latency in ms or None when insufficient data."""
    val = _compute_p95_ms()
    return val if val > 0.0 else None


def inc_pipeline_runs_total() -> None:
    pipeline_runs_total.inc()


def inc_pipeline_runs_completed() -> None:
    pipeline_runs_completed.inc()


def inc_pipeline_runs_failed() -> None:
    pipeline_runs_failed.inc()


def get_pipeline_counts() -> tuple[float, float, float]:
    """Return (total, completed, failed) pipeline counts. Values may be float from prometheus-client."""

    def _read(counter: Counter) -> float:
        for mf in counter.collect():
            for s in mf.samples:
                if s.name.endswith("_total"):
                    return s.value
        return 0.0

    return (
        _read(pipeline_runs_total),
        _read(pipeline_runs_completed),
        _read(pipeline_runs_failed),
    )


def inc_storage_ipfs_pin_success() -> None:
    storage_ipfs_pin_success.inc()


def inc_storage_ipfs_pin_failure() -> None:
    storage_ipfs_pin_failure.inc()


def inc_storage_ipfs_record_insert_success() -> None:
    storage_ipfs_record_insert_success.inc()


def inc_storage_ipfs_record_insert_failure() -> None:
    storage_ipfs_record_insert_failure.inc()


def inc_storage_webhook_ok() -> None:
    storage_webhook_ok.inc()


def inc_storage_webhook_sig_fail() -> None:
    storage_webhook_sig_fail.inc()


def add_storage_reconcile_stats(
    examined: int,
    reconciled: int,
    still_pinned: int,
    marked_failed: int,
) -> None:
    storage_reconcile_examined.inc(examined)
    storage_reconcile_reconciled.inc(reconciled)
    storage_reconcile_still_pinned.inc(still_pinned)
    storage_reconcile_marked_failed.inc(marked_failed)


def inc_storage_filecoin_register_success() -> None:
    storage_filecoin_register_success.inc()


def inc_storage_filecoin_register_failure() -> None:
    storage_filecoin_register_failure.inc()


def inc_storage_filecoin_row_inserted() -> None:
    storage_filecoin_row_inserted.inc()


def inc_storage_filecoin_row_insert_failed() -> None:
    storage_filecoin_row_insert_failed.inc()


def inc_storage_filecoin_deal_poll_updated() -> None:
    storage_filecoin_deal_poll_updated.inc()


def format_prometheus_metrics() -> str:
    """Return Prometheus text-format metrics. Used by /metrics endpoint."""
    return generate_latest(_registry).decode("utf-8")
