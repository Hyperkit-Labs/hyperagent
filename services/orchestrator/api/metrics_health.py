"""
Metrics and health API: health, metrics, config, integrations-debug.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import db
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from registries import (
    ANCHOR_NETWORK_SLUG,
    get_a2a_agent_id,
    get_a2a_default_chain_id,
    get_default_chain_id,
    get_erc8004_agent_identity,
    get_monitoring_enabled,
    get_networks_for_api,
    get_registry_versions,
    get_x402_enabled,
)
from store import count_workflows

import credits_supabase

from observability import p95_latency_ms
from redis_util import effective_redis_url

logger = logging.getLogger(__name__)

COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001").rstrip("/")
AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:8011").rstrip("/")
SIMULATION_SERVICE_URL = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002").rstrip("/")
STORAGE_SERVICE_URL = os.environ.get("STORAGE_SERVICE_URL", "http://localhost:4005").rstrip("/")
VECTORDB_URL = os.environ.get("VECTORDB_URL", "http://localhost:8010").rstrip("/")
INTEGRATIONS_TIMEOUT = float(os.environ.get("INTEGRATIONS_TIMEOUT", "15.0"))
CREDITS_PER_RUN = float(os.environ.get("CREDITS_PER_RUN", "7"))
CREDITS_PER_USD = float(os.environ.get("CREDITS_PER_USD", "10"))
TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")


def _check_supabase_health() -> dict[str, Any]:
    """Ping Supabase when configured."""
    if not db.is_configured():
        return {"status": "not_configured"}
    try:
        client = db._client()
        if client:
            client.table("runs").select("id").limit(1).execute()
            return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}
    return {"status": "not_configured"}


def _check_redis_health() -> dict[str, Any]:
    """Ping Redis TCP (e.g. Upstash) when REDIS_URL is set."""
    url = (os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or "").strip()
    if not url or url.startswith("#"):
        return {"status": "not_configured"}
    try:
        from redis import Redis
        r = Redis.from_url(effective_redis_url(url))
        r.ping()
        return {"status": "ok"}
    except ImportError:
        return {"status": "not_configured", "message": "redis package not installed"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}


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


async def _fetch_integrations() -> dict[str, bool]:
    """Fetch integration status from simulation, storage, and vectordb health endpoints."""
    tenderly = False
    pinata = False
    qdrant = False
    async with httpx.AsyncClient(timeout=INTEGRATIONS_TIMEOUT) as client:
        try:
            r = await client.get(f"{SIMULATION_SERVICE_URL}/health")
            if r.status_code == 200:
                data = r.json()
                tenderly = data.get("tenderly_configured", False)
        except Exception as e:
            logger.warning("[integrations] simulation unreachable url=%s: %s", SIMULATION_SERVICE_URL, e)
        try:
            r = await client.get(f"{STORAGE_SERVICE_URL}/health")
            if r.status_code == 200:
                data = r.json()
                pinata = data.get("pinata_configured", False)
        except Exception as e:
            logger.warning("[integrations] storage unreachable url=%s: %s", STORAGE_SERVICE_URL, e)
        try:
            r = await client.get(f"{VECTORDB_URL}/health")
            if r.status_code == 200:
                data = r.json()
                qdrant = data.get("qdrant_configured", False)
        except Exception as e:
            logger.warning("[integrations] vectordb unreachable url=%s: %s", VECTORDB_URL, e)
    return {"tenderly_configured": tenderly, "pinata_configured": pinata, "qdrant_configured": qdrant}


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


def _root_health_critical_ok() -> tuple[bool, dict[str, Any]]:
    """Check critical deps (Supabase when configured, Redis when QUEUE_ENABLED). Returns (ok, payload)."""
    payload: dict[str, Any] = {"registries": get_registry_versions()}
    supabase = _check_supabase_health()
    redis = _check_redis_health()
    queue_enabled = os.environ.get("QUEUE_ENABLED", "").strip() in ("1", "true", "yes")
    redis_url = (os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or "").strip()
    redis_configured = bool(redis_url and not redis_url.startswith("#"))
    db_ok = supabase.get("status") in ("ok", "not_configured")
    redis_ok = redis.get("status") == "ok" if (queue_enabled and redis_configured) else True
    critical_ok = db_ok and redis_ok
    payload["supabase"] = supabase
    payload["redis"] = redis
    payload["queue_enabled"] = queue_enabled
    return critical_ok, payload


@health_router.get("/health/live")
def health_live():
    """Liveness: HTTP 200 if the app process is serving. No I/O to Supabase, Redis, or downstream services.
    Use this for Docker/Kubernetes liveness so transient dependency failures do not mark the container dead.
    Readiness and dependency status remain on GET /health."""
    return {"status": "ok"}


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
    return PlainTextResponse(format_prometheus_metrics(), media_type="text/plain; charset=utf-8")


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
    services["redis"] = _check_redis_health()
    services["compile"] = _check_service_health("compile", COMPILE_SERVICE_URL)
    services["audit"] = _check_service_health("audit", AUDIT_SERVICE_URL)
    sim_url = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002").strip()
    services["simulation"] = _check_service_health("simulation", sim_url)
    deploy_url = os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003").strip()
    services["deploy"] = _check_service_health("deploy", deploy_url)
    try:
        from rag_client import is_configured as rag_configured
        if not rag_configured():
            services["rag"] = {"status": "NOT_APPLICABLE", "message": "RAG/vectordb not configured for MVP"}
        else:
            services["rag"] = _check_service_health("rag", VECTORDB_URL)
    except ImportError:
        services["rag"] = {"status": "NOT_APPLICABLE", "message": "RAG client not available"}
    exploit_enabled = os.environ.get("EXPLOIT_SIM_ENABLED", "false").lower() in ("true", "1", "yes")
    services["exploit_sim"] = {"status": "NOT_APPLICABLE", "message": "Exploit simulation disabled"} if not exploit_enabled else {"status": "ok", "message": "Enabled"}
    pinata_ok = bool(os.environ.get("PINATA_API_KEY") or os.environ.get("PINATA_JWT"))
    services["trace_writer"] = {"status": "NOT_APPLICABLE", "message": "IPFS not configured; traces use stub IDs"} if not pinata_ok else {"status": "ok", "message": "IPFS configured"}
    if TOOLS_BASE_URL:
        tools_status = _check_tools_health()
        services["tools"] = tools_status
        if tools_status.get("status") == "offline":
            services["tools"]["message"] = "Toolchain offline; compile/audit may fail when using remote tools"
    return {"status": "ok", "services": services, "registries": versions}


# Config router
config_router = APIRouter(prefix="/api/v1/config", tags=["config"])


@config_router.get("/integrations-debug")
async def get_integrations_debug_api() -> dict[str, Any]:
    """Debug endpoint: raw integration health. Use to diagnose Settings > Integrations 'Not configured'."""
    integrations = await _fetch_integrations()
    networks = get_networks_for_api()
    return {
        "agent_runtime_url": AGENT_RUNTIME_URL,
        "simulation_service_url": SIMULATION_SERVICE_URL,
        "storage_service_url": STORAGE_SERVICE_URL,
        "vectordb_url": VECTORDB_URL,
        "integrations_timeout": INTEGRATIONS_TIMEOUT,
        "integrations": integrations,
        "networks_count": len(networks),
        "hint": "Tenderly needs TENDERLY_API_KEY on simulation service. Pinata needs PINATA_JWT on storage service. Qdrant needs QDRANT_URL on vectordb.",
    }


@config_router.get("")
async def get_config_api() -> dict[str, Any]:
    """Return public runtime config (x402, monitoring, payment, integrations, A2A identity) from registries."""
    merchant = os.environ.get("MERCHANT_WALLET_ADDRESS", "").strip()
    integrations = await _fetch_integrations()
    a2a_identity = get_erc8004_agent_identity()
    return {
        "x402_enabled": get_x402_enabled(),
        "monitoring_enabled": get_monitoring_enabled(),
        "merchant_wallet_address": merchant or None,
        "credits_enabled": credits_supabase.is_configured(),
        "credits_per_usd": CREDITS_PER_USD,
        "credits_per_run": CREDITS_PER_RUN,
        "default_network_id": ANCHOR_NETWORK_SLUG,
        "default_chain_id": get_default_chain_id(),
        "a2a_agent_id": get_a2a_agent_id(),
        "a2a_default_chain_id": get_a2a_default_chain_id(),
        "a2a_identity": a2a_identity,
        "integrations": integrations,
    }


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
            from registries import _ERC8004, _ensure_loaded  # type: ignore[attr-defined]
            _ensure_loaded()
            for entry in ((_ERC8004 or {}).get("spec", {}).get("hyperagent", {}).get("agentIds") or []):
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
    chain_id: int | None = Field(None, description="Chain ID. Defaults to A2A_DEFAULT_CHAIN_ID.")
    agent_uri: str | None = Field(None, description="Agent metadata URI. Defaults to ERC8004_AGENT_URI or https://hyperkitlabs.com/agent.json")


@identity_router.post("/register")
def register_agent_identity(body: RegisterIdentityBody | None = None) -> dict[str, Any]:
    """Register this HyperAgent instance on ERC-8004 IdentityRegistry for the given chain.
    Requires ERC8004_REGISTER_PRIVATE_KEY. Persists proof to agent_registrations. Returns agentId, txHash, persistedProof."""
    from erc8004_register import is_configured, register_on_chain
    import db
    if not is_configured():
        raise HTTPException(status_code=503, detail="ERC8004_REGISTER_PRIVATE_KEY not set")
    cid = (body.chain_id if body else None) or get_a2a_default_chain_id()
    if cid is None:
        raise HTTPException(status_code=400, detail="chain_id required or set A2A_DEFAULT_CHAIN_ID")
    result = register_on_chain(cid, body.agent_uri if body else None)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Registration failed"))
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
                    q = client.table("runs").select("id", count="exact").eq("status", status_val)
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
        "workflows": {"total": total, "active": active, "completed": completed, "failed": failed},
        "total_workflows": total,
    }
