"""
Metrics and health API: health, metrics, config, integrations-debug.
"""

import asyncio
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Any

import credits_supabase
import db
import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException
from observability import p95_latency_ms
from pydantic import BaseModel, Field
from redis_util import effective_redis_url
from registries import (
    get_a2a_agent_id,
    get_a2a_default_chain_id,
    get_anchor_network_slug,
    get_default_chain_id,
    get_erc8004_agent_identity,
    get_monitoring_enabled,
    get_networks_for_api,
    get_registry_versions,
    get_x402_enabled,
)
from store import count_workflows

logger = logging.getLogger(__name__)

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001").rstrip(
    "/"
)
AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:8011").rstrip(
    "/"
)
SIMULATION_SERVICE_URL = os.environ.get(
    "SIMULATION_SERVICE_URL", "http://localhost:8002"
).rstrip("/")
STORAGE_SERVICE_URL = os.environ.get(
    "STORAGE_SERVICE_URL", "http://localhost:4005"
).rstrip("/")
VECTORDB_URL = os.environ.get("VECTORDB_URL", "http://localhost:8010").rstrip("/")
# Parallel /health probes for GET /api/v1/config. Defaults stay under typical 10s browser/proxy limits
# (Studio may use a shorter bootstrap timeout via NEXT_PUBLIC_CONFIG_BOOTSTRAP_TIMEOUT_MS).
INTEGRATIONS_HEALTH_TIMEOUT = float(
    os.environ.get(
        "INTEGRATIONS_HEALTH_TIMEOUT",
        os.environ.get("INTEGRATIONS_TIMEOUT", "3.0"),
    )
)
# Upper bound for asyncio.wait_for around _fetch_integrations() (parallel probes).
INTEGRATIONS_FETCH_BUDGET_SEC = float(
    os.environ.get(
        "INTEGRATIONS_FETCH_BUDGET_SEC",
        str(min(7.0, max(4.0, INTEGRATIONS_HEALTH_TIMEOUT * 2.0 + 0.5))),
    )
)
# When TTL expired but a cached payload exists, return it immediately and refresh in background.
INTEGRATIONS_STALE_WHILE_REVALIDATE = os.environ.get(
    "INTEGRATIONS_STALE_WHILE_REVALIDATE", "1"
).strip().lower() in ("1", "true", "yes")
# In-process cache for GET /config integration flags (0 disables).
INTEGRATIONS_CACHE_TTL_SEC = float(os.environ.get("INTEGRATIONS_CACHE_TTL_SEC", "45"))
# After this many consecutive budget timeouts, skip probes for INTEGRATIONS_CIRCUIT_COOLDOWN_SEC.
INTEGRATIONS_CIRCUIT_FAILURE_THRESHOLD = int(
    os.environ.get("INTEGRATIONS_CIRCUIT_FAILURE_THRESHOLD", "3")
)
INTEGRATIONS_CIRCUIT_COOLDOWN_SEC = float(
    os.environ.get("INTEGRATIONS_CIRCUIT_COOLDOWN_SEC", "90")
)
# Hard ceiling for GET /api/v1/config (full handler). Studio aborts the client around
# NEXT_PUBLIC_CONFIG_BOOTSTRAP_TIMEOUT_MS (default 45s); this keeps the server well under
# that so users get JSON (degraded) instead of a browser-side cancel. Override with
# CONFIG_API_BUDGET_SEC (0 disables the outer wait_for; not recommended in production).
CONFIG_API_BUDGET_SEC = float(os.environ.get("CONFIG_API_BUDGET_SEC", "18"))
# Redis health checks: cap socket wait so slow Upstash RTT does not serialize PING+LLEN into multi-second /health.
REDIS_HEALTH_SOCKET_TIMEOUT_SEC = float(
    os.environ.get("REDIS_HEALTH_SOCKET_TIMEOUT_SEC", "2.0")
)

_integrations_cache_payload: dict[str, Any] | None = None
_integrations_cache_mono: float = 0.0
_integrations_consecutive_budget_timeouts: int = 0
_integrations_circuit_open_until: float = 0.0

CREDITS_PER_RUN = float(os.environ.get("CREDITS_PER_RUN", "7"))
CREDITS_PER_USD = float(os.environ.get("CREDITS_PER_USD", "10"))
TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")


def _check_supabase_health() -> dict[str, Any]:
    """Ping Supabase when configured."""
    if not db.is_configured():
        return {"status": "not_configured"}
    last_err: str | None = None
    for attempt in range(2):
        try:
            client = db._client()
            if not client:
                return {"status": "not_configured"}
            client.table("runs").select("id").limit(1).execute()
            return {"status": "ok"}
        except Exception as e:
            last_err = str(e)[:200]
            if attempt == 0 and db.is_transient_supabase_http_error(e):
                logger.warning(
                    "[health] supabase ping transient error, refreshing client: %s",
                    last_err,
                )
                db.invalidate_supabase_client()
                continue
            return {"status": "error", "error": last_err}
    return {"status": "error", "error": last_err or "unknown"}


_redis_consecutive_failures: int = 0


def _check_redis_ping_and_dlq_pipeline() -> (
    tuple[dict[str, Any], dict[str, Any] | None]
):
    """One Redis round trip: PING + optional DLQ LLEN (pipeline). Also applies socket timeouts."""
    global _redis_consecutive_failures
    url = (
        os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or ""
    ).strip()
    queue_enabled = os.environ.get("QUEUE_ENABLED", "").strip() in ("1", "true", "yes")
    if not url or url.startswith("#"):
        return ({"status": "not_configured"}, None)
    try:
        from redis import Redis

        t = max(0.5, REDIS_HEALTH_SOCKET_TIMEOUT_SEC)
        r = Redis.from_url(
            effective_redis_url(url),
            socket_timeout=t,
            socket_connect_timeout=min(t, 5.0),
        )
        pipe = r.pipeline()
        pipe.ping()
        if queue_enabled:
            pipe.llen("queue:hyperagent:dead")
        results = pipe.execute()
        if not results:
            raise RuntimeError("empty redis pipeline")
        if _redis_consecutive_failures > 0:
            logger.info(
                "[redis] connection restored after %d consecutive failures",
                _redis_consecutive_failures,
            )
        _redis_consecutive_failures = 0
        redis_out: dict[str, Any] = {"status": "ok"}
        dlq_out: dict[str, Any] | None = None
        if queue_enabled and len(results) > 1:
            depth = int(results[1])
            dlq_out = {"status": "ok", "depth": depth}
            if depth > 0:
                dlq_out["status"] = "warning"
                logger.warning(
                    "[alert][dlq] dead letter queue has %d unprocessed jobs. Investigate via GET /api/v1/health/detailed.",
                    depth,
                )
        return (redis_out, dlq_out)
    except ImportError:
        return (
            {"status": "not_configured", "message": "redis package not installed"},
            None,
        )
    except Exception as e:
        _redis_consecutive_failures += 1
        err_msg = str(e)[:200]
        logger.error(
            "[alert][redis] connection failed (consecutive=%d): %s. "
            "x402 nonce replay protection is degraded. Queue operations may fail.",
            _redis_consecutive_failures,
            err_msg,
        )
        redis_err = {
            "status": "error",
            "error": err_msg,
            "consecutive_failures": _redis_consecutive_failures,
        }
        dlq_err: dict[str, Any] | None = None
        if queue_enabled:
            dlq_err = {"status": "error", "depth": -1, "error": err_msg}
        return (redis_err, dlq_err)


def _check_redis_health() -> dict[str, Any]:
    """Ping Redis TCP (e.g. Upstash) when REDIS_URL is set."""
    r, _ = _check_redis_ping_and_dlq_pipeline()
    return r


def _check_service_health(name: str, url: str, timeout: float = 2.0) -> dict[str, Any]:
    """Ping a service /health endpoint."""
    if not url or not url.strip():
        return {"status": "not_configured", "url": None}
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.get(f"{url.rstrip('/')}/health")
            if r.status_code == 200:
                return {"status": "ok", "url": url}
            return {"status": "error", "url": url, "code": r.status_code}
    except Exception as e:
        return {"status": "offline", "url": url, "error": str(e)[:200]}


def _check_tools_health() -> dict[str, Any]:
    """Ping hyperagent-tools /health when TOOLS_BASE_URL is set."""
    if not TOOLS_BASE_URL:
        return {"status": "not_configured", "url": None}
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{TOOLS_BASE_URL}/health")
            if r.status_code == 200:
                return {"status": "ok", "url": TOOLS_BASE_URL}
            return {"status": "error", "url": TOOLS_BASE_URL, "code": r.status_code}
    except Exception as e:
        return {"status": "offline", "url": TOOLS_BASE_URL, "error": str(e)}


async def _fetch_integrations() -> dict[str, Any]:
    """Build integration flags from simulation, storage, and vectordb /health (parallel probes)."""
    tenderly = False
    pinata = False
    pinata_dedicated_gateway = False
    filecoin = False
    qdrant = False

    async with httpx.AsyncClient(timeout=INTEGRATIONS_HEALTH_TIMEOUT) as client:

        async def probe_simulation() -> None:
            nonlocal tenderly
            try:
                r = await client.get(f"{SIMULATION_SERVICE_URL}/health")
                if r.status_code == 200:
                    data = r.json()
                    tenderly = data.get("tenderly_configured", False)
            except Exception as e:
                logger.warning(
                    "[integrations] simulation unreachable url=%s: %s",
                    SIMULATION_SERVICE_URL,
                    e,
                )

        async def probe_storage() -> None:
            nonlocal pinata, pinata_dedicated_gateway
            try:
                r = await client.get(f"{STORAGE_SERVICE_URL}/health")
                if r.status_code == 200:
                    data = r.json()
                    pinata = data.get("pinata_configured", False)
                    pinata_dedicated_gateway = data.get(
                        "pinata_dedicated_gateway", False
                    )
            except Exception as e:
                logger.warning(
                    "[integrations] storage unreachable url=%s: %s",
                    STORAGE_SERVICE_URL,
                    e,
                )

        async def probe_vectordb() -> None:
            nonlocal qdrant
            try:
                r = await client.get(f"{VECTORDB_URL}/health")
                if r.status_code == 200:
                    data = r.json()
                    qdrant = data.get("qdrant_configured", False)
            except Exception as e:
                logger.warning(
                    "[integrations] vectordb unreachable url=%s: %s",
                    VECTORDB_URL,
                    e,
                )

        await asyncio.gather(probe_simulation(), probe_storage(), probe_vectordb())

    # Filecoin archival — checked locally (Lighthouse runs in-process, not a separate service)
    filecoin = bool(
        os.environ.get("FILECOIN_ARCHIVAL_ENABLED", "").strip() in ("1", "true", "yes")
        and os.environ.get("LIGHTHOUSE_API_KEY", "").strip()
    )

    # Kite Chain — check RPC reachability for the configured mainnet RPC
    kite_rpc = os.environ.get("KITE_CHAIN_RPC_MAINNET", "").strip()
    kite_configured = bool(kite_rpc)

    return {
        "tenderly_configured": tenderly,
        "pinata_configured": pinata,
        "pinata_dedicated_gateway": pinata_dedicated_gateway,
        "filecoin_configured": filecoin,
        "kite_chain_configured": kite_configured,
        "qdrant_configured": qdrant,
    }


def _integrations_fallback() -> dict[str, Any]:
    """Remote integration flags false; local env-only flags preserved (filecoin, kite)."""
    filecoin = bool(
        os.environ.get("FILECOIN_ARCHIVAL_ENABLED", "").strip() in ("1", "true", "yes")
        and os.environ.get("LIGHTHOUSE_API_KEY", "").strip()
    )
    kite_rpc = os.environ.get("KITE_CHAIN_RPC_MAINNET", "").strip()
    return {
        "tenderly_configured": False,
        "pinata_configured": False,
        "pinata_dedicated_gateway": False,
        "filecoin_configured": filecoin,
        "kite_chain_configured": bool(kite_rpc),
        "qdrant_configured": False,
    }


async def _integrations_background_refresh() -> None:
    """Refresh integration cache after a stale-while-revalidate /config response."""
    try:
        await _fetch_integrations_bounded(force_refresh=True)
    except Exception as e:
        logger.warning("[integrations] background refresh failed: %s", e)


async def _fetch_integrations_bounded(
    *, skip_cache: bool = False, force_refresh: bool = False
) -> dict[str, Any]:
    """Integration flags for /config. Uses TTL cache unless skip_cache (e.g. integrations-debug)."""
    global _integrations_cache_payload, _integrations_cache_mono
    global _integrations_consecutive_budget_timeouts, _integrations_circuit_open_until

    now = time.monotonic()
    if now < _integrations_circuit_open_until:
        return _integrations_fallback()

    if (
        not skip_cache
        and not force_refresh
        and INTEGRATIONS_CACHE_TTL_SEC > 0
        and _integrations_cache_payload is not None
        and (now - _integrations_cache_mono) < INTEGRATIONS_CACHE_TTL_SEC
    ):
        return _integrations_cache_payload

    try:
        result = await asyncio.wait_for(
            _fetch_integrations(),
            timeout=INTEGRATIONS_FETCH_BUDGET_SEC,
        )
        _integrations_consecutive_budget_timeouts = 0
    except TimeoutError:
        logger.warning(
            "[integrations] fetch exceeded budget=%ss; returning fallback flags",
            INTEGRATIONS_FETCH_BUDGET_SEC,
        )
        _integrations_consecutive_budget_timeouts += 1
        if (
            _integrations_consecutive_budget_timeouts
            >= INTEGRATIONS_CIRCUIT_FAILURE_THRESHOLD
        ):
            _integrations_circuit_open_until = now + INTEGRATIONS_CIRCUIT_COOLDOWN_SEC
            logger.warning(
                "[integrations] circuit open %ss after %d budget timeouts",
                INTEGRATIONS_CIRCUIT_COOLDOWN_SEC,
                _integrations_consecutive_budget_timeouts,
            )
        result = _integrations_fallback()

    if not skip_cache and INTEGRATIONS_CACHE_TTL_SEC > 0:
        _integrations_cache_payload = result
        _integrations_cache_mono = time.monotonic()
    return result


def _metrics_since_from_time_range(time_range: str) -> str | None:
    """Return ISO datetime string for filtering, or None for all time."""
    if not time_range or time_range == "all":
        return None
    now = datetime.now(timezone.utc)
    if time_range == "7d":
        since = now - timedelta(days=7)
    elif time_range == "30d":
        since = now - timedelta(days=30)
    elif time_range == "90d":
        since = now - timedelta(days=90)
    else:
        return None
    return since.isoformat()


# Health router (root /health)
health_router = APIRouter(tags=["health"])


def _check_dead_letter_queue() -> dict[str, Any]:
    """DLQ depth from Redis (prefer reusing :func:`_check_redis_ping_and_dlq_pipeline` in the same request)."""
    _, d = _check_redis_ping_and_dlq_pipeline()
    if d is not None:
        return d
    return {"status": "not_configured", "depth": 0}


def _root_health_critical_ok() -> tuple[bool, dict[str, Any]]:
    """Check critical deps (Supabase when configured, Redis when QUEUE_ENABLED). Returns (ok, payload)."""
    payload: dict[str, Any] = {"registries": get_registry_versions()}
    with ThreadPoolExecutor(max_workers=2) as ex:
        fut_s = ex.submit(_check_supabase_health)
        fut_r = ex.submit(_check_redis_ping_and_dlq_pipeline)
    supabase = fut_s.result()
    redis, dlq = fut_r.result()
    queue_enabled = os.environ.get("QUEUE_ENABLED", "").strip() in ("1", "true", "yes")
    redis_url = (
        os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or ""
    ).strip()
    redis_configured = bool(redis_url and not redis_url.startswith("#"))
    db_ok = supabase.get("status") in ("ok", "not_configured")
    redis_ok = (
        redis.get("status") == "ok" if (queue_enabled and redis_configured) else True
    )
    critical_ok = db_ok and redis_ok
    payload["supabase"] = supabase
    payload["redis"] = redis
    payload["queue_enabled"] = queue_enabled
    if queue_enabled and redis_configured:
        payload["dead_letter_queue"] = (
            dlq if dlq is not None else {"status": "not_configured", "depth": 0}
        )
    return critical_ok, payload


@health_router.get("/health/live")
def health_live():
    """Liveness: HTTP 200 if the app process is serving. No I/O to Supabase, Redis, or downstream services.
    Use this for Docker/Kubernetes liveness so transient dependency failures do not mark the container dead.
    Readiness and dependency status remain on GET /health and /health/ready."""
    return {"status": "ok"}


@health_router.get("/health/ready")
def health_ready():
    """Readiness: checks critical dependencies (Supabase, Redis when QUEUE_ENABLED).
    Returns 503 if any critical dep is unreachable. Use for K8s readiness probes
    so traffic is not routed to pods that cannot serve requests."""
    from main import is_startup_degraded

    startup_bad, startup_missing = is_startup_degraded()
    if startup_bad:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "reason": "startup_degraded",
                "missing": startup_missing,
            },
        )

    critical_ok, payload = _root_health_critical_ok()
    if not critical_ok:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "dependency_failure", **payload},
        )
    return {"status": "ready"}


@health_router.get("/health")
def health():
    """Health and registry versions. Returns 503 when startup env is missing or
    critical deps (Supabase, Redis when QUEUE_ENABLED) fail."""
    from main import is_startup_degraded

    startup_bad, startup_missing = is_startup_degraded()
    if startup_bad:
        from fastapi.responses import JSONResponse

        logger.warning("[health] GET /health startup_env_missing: %s", startup_missing)
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "reason": "startup_env_missing",
                "missing": startup_missing,
            },
        )
    critical_ok, payload = _root_health_critical_ok()
    if not critical_ok:
        from fastapi.responses import JSONResponse

        logger.warning(
            "[health] GET /health not critical_ok: supabase=%s redis=%s queue_enabled=%s",
            payload.get("supabase"),
            payload.get("redis"),
            payload.get("queue_enabled"),
        )
        return JSONResponse(status_code=503, content={"status": "degraded", **payload})
    return {"status": "ok", **payload}


@health_router.get("/metrics")
def metrics():
    """Prometheus-format metrics for pipeline runs and p95 latency."""
    from fastapi.responses import PlainTextResponse
    from observability import format_prometheus_metrics

    return PlainTextResponse(
        format_prometheus_metrics(), media_type="text/plain; charset=utf-8"
    )


# API v1 health and metrics router
api_health_router = APIRouter(prefix="/api/v1", tags=["health", "metrics"])


@api_health_router.get("/health/detailed")
def health_detailed() -> dict[str, Any]:
    """Detailed health for Studio. Includes Supabase, Redis, compile, simulation, deploy, tools, RAG.
    Includes p95_latency_ms for SLO monitoring (target: under 2000ms)."""
    versions = get_registry_versions()
    services: dict[str, Any] = {"orchestrator": {"status": "ok"}}
    p95 = p95_latency_ms()
    if p95 is not None:
        services["orchestrator"]["p95_latency_ms"] = round(p95, 0)
        services["orchestrator"]["slo_ok"] = p95 < 2000
    services["supabase"] = _check_supabase_health()
    redis_h, dlq_h = _check_redis_ping_and_dlq_pipeline()
    services["redis"] = redis_h
    queue_enabled = os.environ.get("QUEUE_ENABLED", "").strip() in ("1", "true", "yes")
    if queue_enabled:
        services["dead_letter_queue"] = (
            dlq_h if dlq_h is not None else {"status": "not_configured", "depth": 0}
        )
    services["compile"] = _check_service_health("compile", COMPILE_SERVICE_URL)
    services["audit"] = _check_service_health("audit", AUDIT_SERVICE_URL)
    sim_url = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002").strip()
    services["simulation"] = _check_service_health("simulation", sim_url)
    deploy_url = os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003").strip()
    services["deploy"] = _check_service_health("deploy", deploy_url)
    try:
        from rag_client import is_configured as rag_configured

        if not rag_configured():
            services["rag"] = {
                "status": "NOT_APPLICABLE",
                "message": "RAG/vectordb not configured for MVP",
            }
        else:
            services["rag"] = _check_service_health("rag", VECTORDB_URL)
    except ImportError:
        services["rag"] = {
            "status": "NOT_APPLICABLE",
            "message": "RAG client not available",
        }
    exploit_enabled = os.environ.get("EXPLOIT_SIM_ENABLED", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    services["exploit_sim"] = (
        {"status": "NOT_APPLICABLE", "message": "Exploit simulation disabled"}
        if not exploit_enabled
        else {"status": "ok", "message": "Enabled"}
    )
    pinata_ok = bool(os.environ.get("PINATA_API_KEY") or os.environ.get("PINATA_JWT"))
    services["trace_writer"] = (
        {
            "status": "NOT_APPLICABLE",
            "message": "IPFS not configured; traces use stub IDs",
        }
        if not pinata_ok
        else {"status": "ok", "message": "IPFS configured"}
    )
    if TOOLS_BASE_URL:
        tools_status = _check_tools_health()
        services["tools"] = tools_status
        if tools_status.get("status") == "offline":
            services["tools"][
                "message"
            ] = "Toolchain offline; compile/audit may fail when using remote tools"
    return {"status": "ok", "services": services, "registries": versions}


# Config router
config_router = APIRouter(prefix="/api/v1/config", tags=["config"])


@config_router.get("/integrations-debug")
async def get_integrations_debug_api() -> dict[str, Any]:
    """Debug endpoint: raw integration health. Use to diagnose Settings > Integrations 'Not configured'."""
    integrations = await _fetch_integrations_bounded(skip_cache=True)
    networks = get_networks_for_api()
    return {
        "agent_runtime_url": AGENT_RUNTIME_URL,
        "simulation_service_url": SIMULATION_SERVICE_URL,
        "storage_service_url": STORAGE_SERVICE_URL,
        "vectordb_url": VECTORDB_URL,
        "integrations_cache_ttl_sec": INTEGRATIONS_CACHE_TTL_SEC,
        "integrations_circuit_cooldown_sec": INTEGRATIONS_CIRCUIT_COOLDOWN_SEC,
        "integrations_circuit_failure_threshold": INTEGRATIONS_CIRCUIT_FAILURE_THRESHOLD,
        "integrations_fetch_budget_sec": INTEGRATIONS_FETCH_BUDGET_SEC,
        "integrations_health_timeout": INTEGRATIONS_HEALTH_TIMEOUT,
        "integrations_timeout": INTEGRATIONS_HEALTH_TIMEOUT,
        "integrations": integrations,
        "networks_count": len(networks),
        "hint": "Tenderly needs TENDERLY_API_KEY on simulation service. Pinata needs PINATA_JWT on storage service. Qdrant needs QDRANT_URL on vectordb.",
    }


def _degraded_get_config_payload(background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Safe JSON when the main handler hits CONFIG_API_BUDGET_SEC (stuck I/O, sync work)."""
    merchant = os.environ.get("MERCHANT_WALLET_ADDRESS", "").strip()
    background_tasks.add_task(_integrations_background_refresh)
    a2a_identity = get_erc8004_agent_identity()
    return {
        "x402_enabled": get_x402_enabled(),
        "monitoring_enabled": get_monitoring_enabled(),
        "merchant_wallet_address": merchant or None,
        "credits_enabled": credits_supabase.is_configured(),
        "credits_per_usd": CREDITS_PER_USD,
        "credits_per_run": CREDITS_PER_RUN,
        "default_network_id": get_anchor_network_slug(),
        "default_chain_id": get_default_chain_id(),
        "a2a_agent_id": get_a2a_agent_id(),
        "a2a_default_chain_id": get_a2a_default_chain_id(),
        "a2a_identity": a2a_identity,
        "integrations": _integrations_fallback(),
        "integrations_stale": True,
    }


async def _build_get_config_payload(
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    """Core logic for GET /api/v1/config (wrapped in asyncio.wait_for in get_config_api)."""
    merchant = os.environ.get("MERCHANT_WALLET_ADDRESS", "").strip()
    now = time.monotonic()
    integrations: dict[str, Any]
    integrations_stale = False

    cache_exists = _integrations_cache_payload is not None
    cache_age = (now - _integrations_cache_mono) if cache_exists else None
    cache_expired = (
        cache_exists
        and INTEGRATIONS_CACHE_TTL_SEC > 0
        and cache_age is not None
        and cache_age >= INTEGRATIONS_CACHE_TTL_SEC
    )
    circuit_open = now < _integrations_circuit_open_until

    if (
        INTEGRATIONS_STALE_WHILE_REVALIDATE
        and not cache_exists
        and INTEGRATIONS_CACHE_TTL_SEC > 0
    ):
        # Process just started: avoid blocking session bootstrap on parallel /health probes.
        integrations = _integrations_fallback()
        integrations_stale = True
        background_tasks.add_task(_integrations_background_refresh)
    elif (
        INTEGRATIONS_STALE_WHILE_REVALIDATE
        and cache_exists
        and INTEGRATIONS_CACHE_TTL_SEC > 0
    ):
        if circuit_open:
            if _integrations_cache_payload is not None:
                integrations = _integrations_cache_payload
                integrations_stale = cache_expired
            else:
                integrations = _integrations_fallback()
                integrations_stale = True
        elif cache_expired:
            integrations = _integrations_cache_payload or _integrations_fallback()
            integrations_stale = True
            background_tasks.add_task(_integrations_background_refresh)
        else:
            integrations = await _fetch_integrations_bounded()
    else:
        integrations = await _fetch_integrations_bounded()

    a2a_identity = get_erc8004_agent_identity()
    payload: dict[str, Any] = {
        "x402_enabled": get_x402_enabled(),
        "monitoring_enabled": get_monitoring_enabled(),
        "merchant_wallet_address": merchant or None,
        "credits_enabled": credits_supabase.is_configured(),
        "credits_per_usd": CREDITS_PER_USD,
        "credits_per_run": CREDITS_PER_RUN,
        "default_network_id": get_anchor_network_slug(),
        "default_chain_id": get_default_chain_id(),
        "a2a_agent_id": get_a2a_agent_id(),
        "a2a_default_chain_id": get_a2a_default_chain_id(),
        "a2a_identity": a2a_identity,
        "integrations": integrations,
    }
    if integrations_stale:
        payload["integrations_stale"] = True
    return payload


@config_router.get("")
async def get_config_api(background_tasks: BackgroundTasks) -> dict[str, Any]:
    """Return public runtime config (x402, monitoring, payment, integrations, A2A identity) from registries.

    Uses stale-while-revalidate for ``integrations`` when TTL expired: returns the last cached
    probe result immediately (``integrations_stale: true``) and schedules a background refresh,
    so Studio bootstrap stays fast even if upstream /health probes are slow.

    **Cold start (no in-process cache yet):** with stale-while-revalidate enabled, returns
    env-derived fallback flags immediately and schedules a background probe so the first
    ``GET /api/v1/config`` after deploy does not block on simulation/storage/vectordb.

    **Overall deadline:** if the handler does not complete within ``CONFIG_API_BUDGET_SEC`` (default
    18s), returns a degraded payload so clients do not hang until the browser abort (often 45s).
    Set ``CONFIG_API_BUDGET_SEC=0`` to disable the outer wait (for debugging only).
    """
    if CONFIG_API_BUDGET_SEC <= 0:
        return await _build_get_config_payload(background_tasks)
    try:
        return await asyncio.wait_for(
            _build_get_config_payload(background_tasks),
            timeout=CONFIG_API_BUDGET_SEC,
        )
    except TimeoutError:
        logger.error(
            "[config] exceeded CONFIG_API_BUDGET_SEC=%ss; returning degraded payload",
            CONFIG_API_BUDGET_SEC,
        )
        return _degraded_get_config_payload(background_tasks)


# Agent identity router (ERC-8004)
identity_router = APIRouter(prefix="/api/v1/identity", tags=["identity"])


@identity_router.get("")
def get_agent_identity() -> dict[str, Any]:
    """Return ERC-8004 agent identity for this HyperAgent instance.

    Includes agentId, identityRegistry address, and registration proof (txHash) from
    infra/registries/erc8004/erc8004.yaml. The agent is pre-registered on SKALE Sepolia
    (agentId=1) and Avalanche Fuji (agentId=60). New chain registration is Phase 2.
    """
    chain_id = get_a2a_default_chain_id()
    identity = get_erc8004_agent_identity(chain_id) if chain_id is not None else None

    # Load full registration proof from erc8004.yaml for the active chain.
    reg_proof: dict[str, Any] | None = None
    if chain_id is not None:
        try:
            from registries import _ERC8004  # type: ignore[attr-defined]
            from registries import _ensure_loaded

            _ensure_loaded()
            for entry in (_ERC8004 or {}).get("spec", {}).get("hyperagent", {}).get(
                "agentIds"
            ) or []:
                if entry.get("chainId") == chain_id:
                    reg_proof = {
                        "agentId": str(entry.get("agentId", "")),
                        "registerTxHash": entry.get("registerTxHash"),
                        "slug": entry.get("slug"),
                    }
                    break
        except Exception:
            pass

    return {
        "agentId": identity.get("agentId") if identity else None,
        "agentRegistry": identity.get("agentRegistry") if identity else None,
        "chainId": chain_id,
        "registrationProof": reg_proof,
        "paymentWallet": os.environ.get("MERCHANT_WALLET_ADDRESS", "").strip() or None,
        "standard": "ERC-8004",
        "phase": "registered",
    }


class RegisterIdentityBody(BaseModel):
    chain_id: int | None = Field(
        None, description="Chain ID. Defaults to A2A_DEFAULT_CHAIN_ID."
    )
    agent_uri: str | None = Field(
        None,
        description="Agent metadata URI. Defaults to ERC8004_AGENT_URI or https://hyperkitlabs.com/agent.json",
    )


@identity_router.post("/register")
def register_agent_identity(body: RegisterIdentityBody | None = None) -> dict[str, Any]:
    """Register this HyperAgent instance on ERC-8004 IdentityRegistry for the given chain.
    Requires ERC8004_REGISTER_PRIVATE_KEY. Persists proof to agent_registrations. Returns agentId, txHash, persistedProof.
    """
    import db
    from erc8004_register import is_configured, register_on_chain

    if not is_configured():
        raise HTTPException(
            status_code=503, detail="ERC8004_REGISTER_PRIVATE_KEY not set"
        )
    cid = (body.chain_id if body else None) or get_a2a_default_chain_id()
    if cid is None:
        raise HTTPException(
            status_code=400, detail="chain_id required or set A2A_DEFAULT_CHAIN_ID"
        )
    result = register_on_chain(cid, body.agent_uri if body else None)
    if not result.get("success"):
        raise HTTPException(
            status_code=502, detail=result.get("error", "Registration failed")
        )
    persisted = None
    if db.is_configured():
        persisted = db.insert_agent_registration(
            tx_hash=result["txHash"],
            chain_id=result["chainId"],
            agent_id=result["agentId"],
            contract_address=result.get("contractAddress", ""),
            source_route="/api/v1/identity/register",
        )
    out = {
        "success": True,
        "agentId": result["agentId"],
        "txHash": result["txHash"],
        "chainId": result["chainId"],
        "contractAddress": result.get("contractAddress"),
    }
    if persisted:
        out["persistedProof"] = {
            "id": str(persisted.get("id", "")),
            "tx_hash": persisted.get("tx_hash"),
            "chain_id": persisted.get("chain_id"),
            "agent_id": persisted.get("agent_id"),
            "contract_address": persisted.get("contract_address"),
            "source_route": persisted.get("source_route"),
            "created_at": persisted.get("created_at"),
        }
    return out


# Metrics router
metrics_router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


@metrics_router.get("")
def get_metrics_api(time_range: str = "all") -> dict[str, Any]:
    """Return basic metrics for Studio dashboard. time_range: 7d, 30d, 90d, all."""
    total = count_workflows()
    active = 0
    completed = 0
    failed = 0
    since = _metrics_since_from_time_range(time_range or "all")
    if db.is_configured():
        try:
            client = db._client()
            if client:
                for status_val, counter_name in [
                    ("running", "active"),
                    ("success", "completed"),
                    ("failed", "failed"),
                ]:
                    q = (
                        client.table("runs")
                        .select("id", count="exact")
                        .eq("status", status_val)
                    )
                    if since:
                        q = q.gte("created_at", since)
                    r = q.execute()
                    cnt = int(getattr(r, "count", 0) or 0)
                    if counter_name == "active":
                        active = cnt
                    elif counter_name == "completed":
                        completed = cnt
                    else:
                        failed = cnt
        except Exception as e:
            logger.warning("[metrics] count by status failed: %s", e)
            completed = total
    else:
        completed = total
    if since:
        total = active + completed + failed
    return {
        "workflows": {
            "total": total,
            "active": active,
            "completed": completed,
            "failed": failed,
        },
        "total_workflows": total,
    }
