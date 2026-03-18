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
        lines.extend([
            "# HELP hyperagent_p95_latency_ms P95 request latency in milliseconds",
            "# TYPE hyperagent_p95_latency_ms gauge",
            f"hyperagent_p95_latency_ms {p95:.0f}",
        ])
    return "\n".join(lines) + "\n"
