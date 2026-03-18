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


def _is_production() -> bool:
    """True when RENDER=true or NODE_ENV=production or similar production indicators."""
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


@app.on_event("startup")
def _validate_critical_services() -> None:
    """Fail fast in production when required services are missing. Warns in dev."""
    if _is_production():
        missing: list[str] = []
        redis_url = os.environ.get("REDIS_URL", "").strip()
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
            logger.error(
                "[orchestrator] Production requires: %s. Exiting.",
                ", ".join(missing),
            )
            raise SystemExit(1)

    required = [
        ("COMPILE_SERVICE_URL", COMPILE_SERVICE_URL),
        ("AUDIT_SERVICE_URL", AUDIT_SERVICE_URL),
        ("AGENT_RUNTIME_URL", os.environ.get("AGENT_RUNTIME_URL", "").strip()),
    ]
    missing = [k for k, v in required if not v or v.startswith("http://localhost:")]
    if missing:
        logger.warning(
            "[orchestrator] Critical services not configured: %s. "
            "Workflow pipeline will fail.",
            ", ".join(missing),
        )
    scrubd_path = os.environ.get("SCRUBD_PATH", "./data/SCRUBD").strip()
    labels = Path(scrubd_path).resolve() / "SCRUBD-CD" / "data" / "labels.csv"
    if not labels.exists():
        logger.warning(
            "[orchestrator] SCRUBD dataset not found at %s.",
            labels,
        )


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
app.include_router(health_router)
app.include_router(api_health_router)
app.include_router(config_router)
app.include_router(metrics_router)
app.include_router(identity_router)
