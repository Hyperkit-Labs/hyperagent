"""
Observability: request latency buffer for p95 SLO, pipeline counters, Prometheus metrics.
Middleware records latencies here; metrics_health reads p95 and exposes /metrics.
"""

_LATENCY_BUFFER_SIZE = 1000
_request_latencies: list[float] = []

# Pipeline counters (in-memory; use external metrics for production scale)
_pipeline_runs_total = 0
_pipeline_runs_completed = 0
_pipeline_runs_failed = 0

# Storage subsystem (IPFS, webhooks, reconcile, Filecoin First)
_storage_ipfs_pin_success = 0
_storage_ipfs_pin_failure = 0
_storage_ipfs_record_insert_success = 0
_storage_ipfs_record_insert_failure = 0
_storage_webhook_ok = 0
_storage_webhook_sig_fail = 0
_storage_reconcile_examined = 0
_storage_reconcile_reconciled = 0
_storage_reconcile_still_pinned = 0
_storage_reconcile_marked_failed = 0
_storage_filecoin_register_success = 0
_storage_filecoin_register_failure = 0
_storage_filecoin_row_inserted = 0
_storage_filecoin_row_insert_failed = 0
_storage_filecoin_deal_poll_updated = 0


def record_latency(elapsed: float) -> None:
    """Record request latency (seconds). Excludes /health and /streaming/ paths."""
    global _request_latencies
    _request_latencies.append(elapsed)
    if len(_request_latencies) > _LATENCY_BUFFER_SIZE:
        _request_latencies[:] = _request_latencies[-_LATENCY_BUFFER_SIZE:]


def p95_latency_ms() -> float | None:
    """Return p95 latency in ms from recent requests, or None if insufficient data."""
    if len(_request_latencies) < 10:
        return None
    sorted_ = sorted(_request_latencies)
    idx = int(len(sorted_) * 0.95) - 1
    idx = max(0, idx)
    return sorted_[idx] * 1000


def inc_pipeline_runs_total() -> None:
    """Increment pipeline run counter. Call when a run starts."""
    global _pipeline_runs_total
    _pipeline_runs_total += 1


def inc_pipeline_runs_completed() -> None:
    """Increment completed pipeline counter."""
    global _pipeline_runs_completed
    _pipeline_runs_completed += 1


def inc_pipeline_runs_failed() -> None:
    """Increment failed pipeline counter."""
    global _pipeline_runs_failed
    _pipeline_runs_failed += 1


def get_pipeline_counts() -> tuple[int, int, int]:
    """Return (total, completed, failed) pipeline counts."""
    return _pipeline_runs_total, _pipeline_runs_completed, _pipeline_runs_failed


def inc_storage_ipfs_pin_success() -> None:
    global _storage_ipfs_pin_success
    _storage_ipfs_pin_success += 1


def inc_storage_ipfs_pin_failure() -> None:
    global _storage_ipfs_pin_failure
    _storage_ipfs_pin_failure += 1


def inc_storage_ipfs_record_insert_success() -> None:
    global _storage_ipfs_record_insert_success
    _storage_ipfs_record_insert_success += 1


def inc_storage_ipfs_record_insert_failure() -> None:
    global _storage_ipfs_record_insert_failure
    _storage_ipfs_record_insert_failure += 1


def inc_storage_webhook_ok() -> None:
    global _storage_webhook_ok
    _storage_webhook_ok += 1


def inc_storage_webhook_sig_fail() -> None:
    global _storage_webhook_sig_fail
    _storage_webhook_sig_fail += 1


def add_storage_reconcile_stats(
    examined: int,
    reconciled: int,
    still_pinned: int,
    marked_failed: int,
) -> None:
    global _storage_reconcile_examined, _storage_reconcile_reconciled
    global _storage_reconcile_still_pinned, _storage_reconcile_marked_failed
    _storage_reconcile_examined += examined
    _storage_reconcile_reconciled += reconciled
    _storage_reconcile_still_pinned += still_pinned
    _storage_reconcile_marked_failed += marked_failed


def inc_storage_filecoin_register_success() -> None:
    global _storage_filecoin_register_success
    _storage_filecoin_register_success += 1


def inc_storage_filecoin_register_failure() -> None:
    global _storage_filecoin_register_failure
    _storage_filecoin_register_failure += 1


def inc_storage_filecoin_row_inserted() -> None:
    global _storage_filecoin_row_inserted
    _storage_filecoin_row_inserted += 1


def inc_storage_filecoin_row_insert_failed() -> None:
    global _storage_filecoin_row_insert_failed
    _storage_filecoin_row_insert_failed += 1


def inc_storage_filecoin_deal_poll_updated() -> None:
    global _storage_filecoin_deal_poll_updated
    _storage_filecoin_deal_poll_updated += 1


def format_prometheus_metrics() -> str:
    """Format Prometheus-style metrics for /metrics endpoint."""
    total, completed, failed = get_pipeline_counts()
    lines = [
        "# HELP hyperagent_pipeline_runs_total Total pipeline runs started",
        "# TYPE hyperagent_pipeline_runs_total counter",
        f"hyperagent_pipeline_runs_total {total}",
        "# HELP hyperagent_pipeline_runs_completed Pipeline runs completed successfully",
        "# TYPE hyperagent_pipeline_runs_completed counter",
        f"hyperagent_pipeline_runs_completed {completed}",
        "# HELP hyperagent_pipeline_runs_failed Pipeline runs failed",
        "# TYPE hyperagent_pipeline_runs_failed counter",
        f"hyperagent_pipeline_runs_failed {failed}",
    ]
    p95 = p95_latency_ms()
    if p95 is not None:
        lines.extend(
            [
                "# HELP hyperagent_p95_latency_ms P95 request latency in milliseconds",
                "# TYPE hyperagent_p95_latency_ms gauge",
                f"hyperagent_p95_latency_ms {p95:.0f}",
            ]
        )
    lines.extend(
        [
            "# HELP hyperagent_storage_ipfs_pin_success_total Successful IPFS pin_json completions",
            "# TYPE hyperagent_storage_ipfs_pin_success_total counter",
            f"hyperagent_storage_ipfs_pin_success_total {_storage_ipfs_pin_success}",
            "# HELP hyperagent_storage_ipfs_pin_failure_total Failed IPFS pin_json attempts",
            "# TYPE hyperagent_storage_ipfs_pin_failure_total counter",
            f"hyperagent_storage_ipfs_pin_failure_total {_storage_ipfs_pin_failure}",
            "# HELP hyperagent_storage_ipfs_record_insert_success_total storage_records IPFS rows inserted",
            "# TYPE hyperagent_storage_ipfs_record_insert_success_total counter",
            f"hyperagent_storage_ipfs_record_insert_success_total {_storage_ipfs_record_insert_success}",
            "# HELP hyperagent_storage_ipfs_record_insert_failure_total storage_records IPFS insert errors",
            "# TYPE hyperagent_storage_ipfs_record_insert_failure_total counter",
            f"hyperagent_storage_ipfs_record_insert_failure_total {_storage_ipfs_record_insert_failure}",
            "# HELP hyperagent_storage_webhook_ok_total Pinata webhook rows updated",
            "# TYPE hyperagent_storage_webhook_ok_total counter",
            f"hyperagent_storage_webhook_ok_total {_storage_webhook_ok}",
            "# HELP hyperagent_storage_webhook_sig_fail_total Pinata webhook signature failures",
            "# TYPE hyperagent_storage_webhook_sig_fail_total counter",
            f"hyperagent_storage_webhook_sig_fail_total {_storage_webhook_sig_fail}",
            "# HELP hyperagent_storage_reconcile_examined_total Gateway re-verify rows examined",
            "# TYPE hyperagent_storage_reconcile_examined_total counter",
            f"hyperagent_storage_reconcile_examined_total {_storage_reconcile_examined}",
            "# HELP hyperagent_storage_reconcile_reconciled_total Rows moved to reconciled",
            "# TYPE hyperagent_storage_reconcile_reconciled_total counter",
            f"hyperagent_storage_reconcile_reconciled_total {_storage_reconcile_reconciled}",
            "# HELP hyperagent_storage_reconcile_still_pinned_total Rows still pinned after failed HEAD",
            "# TYPE hyperagent_storage_reconcile_still_pinned_total counter",
            f"hyperagent_storage_reconcile_still_pinned_total {_storage_reconcile_still_pinned}",
            "# HELP hyperagent_storage_reconcile_marked_failed_total Rows marked failed after reconcile",
            "# TYPE hyperagent_storage_reconcile_marked_failed_total counter",
            f"hyperagent_storage_reconcile_marked_failed_total {_storage_reconcile_marked_failed}",
            "# HELP hyperagent_storage_filecoin_register_success_total Lighthouse Filecoin First CID registrations",
            "# TYPE hyperagent_storage_filecoin_register_success_total counter",
            f"hyperagent_storage_filecoin_register_success_total {_storage_filecoin_register_success}",
            "# HELP hyperagent_storage_filecoin_register_failure_total Filecoin First registration failures",
            "# TYPE hyperagent_storage_filecoin_register_failure_total counter",
            f"hyperagent_storage_filecoin_register_failure_total {_storage_filecoin_register_failure}",
            "# HELP hyperagent_storage_filecoin_row_inserted_total storage_records filecoin rows inserted",
            "# TYPE hyperagent_storage_filecoin_row_inserted_total counter",
            f"hyperagent_storage_filecoin_row_inserted_total {_storage_filecoin_row_inserted}",
            "# HELP hyperagent_storage_filecoin_row_insert_failed_total storage_records filecoin insert failures",
            "# TYPE hyperagent_storage_filecoin_row_insert_failed_total counter",
            f"hyperagent_storage_filecoin_row_insert_failed_total {_storage_filecoin_row_insert_failed}",
            "# HELP hyperagent_storage_filecoin_deal_poll_updated_total Filecoin deal status poll updates",
            "# TYPE hyperagent_storage_filecoin_deal_poll_updated_total counter",
            f"hyperagent_storage_filecoin_deal_poll_updated_total {_storage_filecoin_deal_poll_updated}",
        ]
    )
    return "\n".join(lines) + "\n"
