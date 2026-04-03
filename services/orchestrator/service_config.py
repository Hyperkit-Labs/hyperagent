"""
Service discovery: env-driven URLs. In production, no localhost default; fail fast when missing.
"""

from __future__ import annotations

import os

SERVICES = {
    "orchestrator": ("ORCHESTRATOR_URL", "http://localhost:8000"),
    "agent_runtime": ("AGENT_RUNTIME_URL", "http://localhost:4001"),
    "compile": ("COMPILE_SERVICE_URL", "http://localhost:8004"),
    "audit": ("AUDIT_SERVICE_URL", "http://localhost:8001"),
    "simulation": ("SIMULATION_SERVICE_URL", "http://localhost:8002"),
    "deploy": ("DEPLOY_SERVICE_URL", "http://localhost:8003"),
    "storage": ("STORAGE_SERVICE_URL", "http://localhost:4005"),
    "vectordb": ("VECTORDB_URL", "http://localhost:8010"),
}

IS_PRODUCTION = (
    os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production"
)


def get_service_url(service: str) -> str:
    """Return URL for service. In production, require explicit env (no localhost default)."""
    entry = SERVICES.get(service)
    if not entry:
        raise ValueError(f"Unknown service: {service}")
    key, default = entry
    val = (os.environ.get(key) or "").strip().rstrip("/")
    if val:
        return val
    if IS_PRODUCTION:
        raise RuntimeError(f"Production requires {key} for service {service}")
    return default
