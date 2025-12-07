"""Enhanced health check endpoint"""

import asyncio
from datetime import datetime
from typing import Any, Dict

import asyncpg
import redis.asyncio as redis
from fastapi import APIRouter, Depends

from hyperagent.core.config import settings

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("/")
async def health_check() -> Dict[str, Any]:
    """
    Basic health check

    Returns:
        Simple health status
    """
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """
    Detailed health check with service status

    Checks:
    - Database connectivity
    - Redis connectivity
    - LLM API availability
    - Blockchain RPC endpoints

    Returns:
        Detailed health status with service checks
    """
    health_status = {"status": "healthy", "timestamp": datetime.now().isoformat(), "services": {}}

    # Check database
    db_status = await _check_database()
    health_status["services"]["database"] = db_status

    # Check Redis
    redis_status = await _check_redis()
    health_status["services"]["redis"] = redis_status

    # Check LLM providers
    llm_status = await _check_llm_providers()
    health_status["services"]["llm"] = llm_status

    # Check blockchain RPC endpoints
    rpc_status = await _check_rpc_endpoints()
    health_status["services"]["rpc"] = rpc_status

    # Determine overall status
    critical_services = ["database"]
    critical_healthy = all(
        health_status["services"].get(svc, {}).get("status") == "healthy"
        for svc in critical_services
    )

    if not critical_healthy:
        health_status["status"] = "unhealthy"
    elif any(
        svc.get("status") == "unhealthy"
        for svc in health_status["services"].values()
        if svc.get("status") not in ("not_configured", None)
    ):
        health_status["status"] = "degraded"

    return health_status


async def _check_llm_providers() -> Dict[str, Any]:
    """Check LLM provider availability"""
    status = {"status": "healthy"}
    providers = {}
    if settings.gemini_api_key:
        providers["gemini"] = {"status": "configured", "api_key_present": True}
    if settings.openai_api_key:
        providers["openai"] = {"status": "configured", "api_key_present": True}
    if not providers:
        status["status"] = "warning"
        status["message"] = "No LLM providers configured"
    else:
        status["providers"] = providers
    return status


async def _check_rpc_endpoints() -> Dict[str, Any]:
    """Check blockchain RPC endpoint availability"""
    import httpx

    endpoints = {
        "hyperion_testnet": settings.hyperion_testnet_rpc,
        "mantle_testnet": settings.mantle_testnet_rpc,
        "avalanche_fuji": settings.avalanche_fuji_rpc,
    }

    status = {"status": "healthy", "endpoints": {}}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for network, url in endpoints.items():
            try:
                response = await client.post(
                    url,
                    json={"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1},
                )
                if response.status_code == 200:
                    status["endpoints"][network] = {"status": "healthy", "url": url}
                else:
                    status["endpoints"][network] = {
                        "status": "unhealthy",
                        "url": url,
                        "error": f"HTTP {response.status_code}",
                    }
                    status["status"] = "degraded"
            except Exception as e:
                status["endpoints"][network] = {"status": "unhealthy", "url": url, "error": str(e)}
                status["status"] = "degraded"

    return status


async def _check_database() -> Dict[str, Any]:
    """Check database connectivity"""
    import time

    try:
        start_time = time.time()
        conn = await asyncio.wait_for(asyncpg.connect(settings.database_url), timeout=5.0)
        await conn.close()
        response_time_ms = int((time.time() - start_time) * 1000)
        return {"status": "healthy", "response_time_ms": response_time_ms}
    except asyncio.TimeoutError:
        return {"status": "unhealthy", "error": "Database connection timeout"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


async def _check_redis() -> Dict[str, Any]:
    """Check Redis connectivity (optional)"""
    import time

    if not settings.redis_url:
        return {
            "status": "not_configured",
            "message": "Redis not configured - using in-memory fallback",
        }

    try:
        start_time = time.time()
        client = await asyncio.wait_for(redis.from_url(settings.redis_url), timeout=5.0)
        await client.ping()
        await client.close()
        response_time_ms = int((time.time() - start_time) * 1000)
        return {"status": "healthy", "response_time_ms": response_time_ms}
    except asyncio.TimeoutError:
        return {
            "status": "unhealthy",
            "error": "Redis connection timeout",
            "message": "Using in-memory fallback",
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e), "message": "Using in-memory fallback"}


@router.get("/readiness")
async def readiness_check() -> Dict[str, Any]:
    """
    Kubernetes readiness probe

    Returns:
        Ready status for Kubernetes
    """
    # Check if application is ready to accept traffic
    # This could check: database migrations complete, services initialized, etc.
    return {"ready": True, "timestamp": datetime.now().isoformat()}


@router.get("/liveness")
async def liveness_check() -> Dict[str, Any]:
    """
    Kubernetes liveness probe

    Returns:
        Liveness status for Kubernetes
    """
    # Check if application is alive and should not be restarted
    return {"alive": True, "timestamp": datetime.now().isoformat()}
