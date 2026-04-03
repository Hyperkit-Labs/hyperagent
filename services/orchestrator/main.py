"""
HyperAgent Orchestrator
FastAPI app: workflows CRUD, runs, networks, metrics, BYOK, deploy, UI schema. Studio contract for E2E.
"""

from pathlib import Path

# Load .env from repo root so X402_ENABLED, CREDITS_ENABLED, etc. are available when running locally.
try:
    from dotenv import load_dotenv

    _repo_root = Path(__file__).resolve().parent.parent.parent
    _env_path = _repo_root / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass

import logging
import os
import time

from fastapi import FastAPI, Request
from structured_logging import TraceContextFilter
from trace_context import set_request_id

from api import (
    agents_router,
    approve_spec_legacy_router,
    config_router,
    contracts_router,
    credits_router,
    debug_sandbox_router,
    health_router,
    api_health_router,
    identity_router,
    llm_keys_router,
    logs_router,
    metrics_router,
    payments_router,
    pipeline_router,
    pricing_router,
    reconciliation_router,
    registry_router,
    runs_router,
    sandbox_router,
    security_router,
    ui_export_router,
    workflows_router,
    workflows_streaming_router,
)
from observability import record_latency

logger = logging.getLogger(__name__)

# Wire structured logging so run_id, request_id, step_id propagate to all logs
_root_logger = logging.getLogger()
if not any(isinstance(f, TraceContextFilter) for f in _root_logger.filters):
    _root_logger.addFilter(TraceContextFilter())

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001").rstrip(
    "/"
)

app = FastAPI(title="HyperAgent Orchestrator", version="0.1.0")

# Startup-validation state: when critical env vars are missing in production,
# we set this instead of killing the process so the container stays alive,
# /health returns 503 (readable for debugging), and /health/live stays 200.
_startup_degraded: bool = False
_startup_missing_vars: list[str] = []


def _is_production() -> bool:
    """True when RENDER=true or NODE_ENV=production or similar production indicators."""
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


def is_startup_degraded() -> tuple[bool, list[str]]:
    """Check whether startup validation flagged missing env vars."""
    return _startup_degraded, list(_startup_missing_vars)


@app.on_event("startup")
def _validate_critical_services() -> None:
    """Log errors when required services are missing. Sets degraded flag instead of
    crashing (SystemExit) so the container stays alive and /health can report the
    exact missing vars for debugging via Coolify/K8s container logs."""
    global _startup_degraded, _startup_missing_vars

    if _is_production():
        missing: list[str] = []
        redis_url = (os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or "").strip()
        if not redis_url:
            missing.append("REDIS_URL")
        pinata_jwt = os.environ.get("PINATA_JWT", "").strip()
        pinata_api_key = os.environ.get("PINATA_API_KEY", "").strip()
        if not pinata_jwt and not pinata_api_key:
            missing.append("PINATA_JWT or PINATA_API_KEY")
        supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not supabase_url or not supabase_key:
            missing.append("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        if missing:
            _startup_degraded = True
            _startup_missing_vars = missing
            strict = os.environ.get("STRICT_STARTUP", "").strip().lower() in ("1", "true", "yes")
            if strict:
                logger.critical(
                    "[orchestrator] STRICT_STARTUP: aborting. Missing required env: %s",
                    ", ".join(missing),
                )
                raise SystemExit(
                    f"STRICT_STARTUP: missing required env vars: {', '.join(missing)}"
                )
            logger.error(
                "[orchestrator] Production requires: %s. "
                "Process will stay alive but /health returns 503 until resolved. "
                "Set STRICT_STARTUP=1 to abort instead.",
                ", ".join(missing),
            )

    required = [
        ("COMPILE_SERVICE_URL", COMPILE_SERVICE_URL),
        ("AUDIT_SERVICE_URL", AUDIT_SERVICE_URL),
        ("AGENT_RUNTIME_URL", os.environ.get("AGENT_RUNTIME_URL", "").strip()),
        ("SIMULATION_SERVICE_URL", os.environ.get("SIMULATION_SERVICE_URL", "").strip()),
        ("STORAGE_SERVICE_URL", os.environ.get("STORAGE_SERVICE_URL", "").strip()),
        ("DEPLOY_SERVICE_URL", os.environ.get("DEPLOY_SERVICE_URL", "").strip()),
    ]
    missing_svc = [k for k, v in required if not v or v.startswith("http://localhost:")]
    if missing_svc:
        logger.warning(
            "[orchestrator] Critical services not configured: %s. "
            "Workflow pipeline will fail.",
            ", ".join(missing_svc),
        )
    if _is_production() and missing_svc:
        _startup_degraded = True
        _startup_missing_vars.extend(missing_svc)
        logger.error(
            "[orchestrator] Production requires explicit service URLs (no localhost). "
            "Missing or localhost: %s. /health returns 503 until resolved.",
            ", ".join(missing_svc),
        )
    scrubd_path = os.environ.get("SCRUBD_PATH", "./data/SCRUBD").strip()
    labels = Path(scrubd_path).resolve() / "SCRUBD-CD" / "data" / "labels.csv"
    if not labels.exists():
        logger.warning(
            "[orchestrator] SCRUBD dataset not found at %s.",
            labels,
        )


@app.on_event("startup")
def _start_reconciliation_schedule() -> None:
    """Start a background thread for periodic billing reconciliation every 6 hours."""
    import threading

    interval_s = int(os.environ.get("RECONCILIATION_INTERVAL_SEC", str(6 * 3600)))
    if interval_s <= 0:
        return

    def _reconcile_loop():
        import time as _time
        _time.sleep(60)
        while True:
            try:
                from billing_reconciliation import find_drifted_users
                drifted = find_drifted_users(threshold=0.01, limit=200)
                if drifted:
                    logger.warning(
                        "[reconciliation] found %d drifted users in scheduled check",
                        len(drifted),
                    )
                else:
                    logger.info("[reconciliation] scheduled check: no drift detected")
            except Exception as e:
                logger.error("[reconciliation] scheduled check failed: %s", e)
            _time.sleep(interval_s)

    t = threading.Thread(target=_reconcile_loop, daemon=True, name="billing-reconciliation")
    t.start()
    logger.info("[orchestrator] billing reconciliation scheduled every %ds", interval_s)


@app.middleware("http")
async def log_request_id(request: Request, call_next):
    """Set and log x-request-id for trace correlation. Records latency for p95 SLO.
    When OPENTELEMETRY_ENABLED, creates request span for distributed tracing."""
    rid = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    ).strip() or None
    set_request_id(rid)
    if rid:
        logger.info("[orchestrator] request_id=%s path=%s", rid, request.url.path)
    start = time.perf_counter()
    from otel_spans import request_span

    with request_span(
        method=request.method or "GET",
        path=request.url.path or "/",
        request_id=rid,
    ):
        response = await call_next(request)
    elapsed = time.perf_counter() - start
    path = request.url.path or ""
    if "/health" not in path and "/streaming/" not in path:
        record_latency(elapsed)
    response.headers["X-Response-Time-Ms"] = f"{elapsed * 1000:.0f}"
    return response


# x402 enforcement middleware: intercepts protected endpoints for external callers.
# Internal callers (Studio users with X-User-Id) skip x402 and use credits instead.
try:
    from x402_middleware import X402EnforcementMiddleware

    app.add_middleware(X402EnforcementMiddleware)
    logger.info("[orchestrator] x402 enforcement middleware loaded")
except ImportError:
    logger.warning("[orchestrator] x402_middleware not available; x402 enforcement disabled")

# Include routers. Order matters: more specific routes (e.g. /generate) before parametric ({workflow_id}).
app.include_router(pipeline_router)
app.include_router(workflows_router)
app.include_router(workflows_streaming_router)
app.include_router(ui_export_router)
app.include_router(debug_sandbox_router)
app.include_router(runs_router)
app.include_router(approve_spec_legacy_router)
app.include_router(security_router)
app.include_router(registry_router)
app.include_router(logs_router)
app.include_router(agents_router)
app.include_router(contracts_router)
app.include_router(llm_keys_router)
app.include_router(sandbox_router)
app.include_router(credits_router)
app.include_router(payments_router)
app.include_router(pricing_router)
app.include_router(reconciliation_router)
app.include_router(health_router)
app.include_router(api_health_router)
app.include_router(config_router)
app.include_router(metrics_router)
app.include_router(identity_router)
