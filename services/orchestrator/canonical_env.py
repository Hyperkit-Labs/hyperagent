"""Canonical env parsing and service URL resolution for Python services (single parse path)."""

from __future__ import annotations

import os
from typing import Final


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    v = value.strip().lower()
    if v in ("1", "true", "yes"):
        return True
    if v in ("0", "false", "no"):
        return False
    return default


def is_production() -> bool:
    return (
        os.environ.get("NODE_ENV") == "production"
        or os.environ.get("ENV") == "production"
    )


SERVICE_URL_MAP: Final[dict[str, tuple[str, str]]] = {
    "orchestrator": ("ORCHESTRATOR_URL", "http://localhost:8000"),
    "agent_runtime": ("AGENT_RUNTIME_URL", "http://localhost:4001"),
    "compile": ("COMPILE_SERVICE_URL", "http://localhost:8004"),
    "audit": ("AUDIT_SERVICE_URL", "http://localhost:8001"),
    "simulation": ("SIMULATION_SERVICE_URL", "http://localhost:8002"),
    "deploy": ("DEPLOY_SERVICE_URL", "http://localhost:8003"),
    "storage": ("STORAGE_SERVICE_URL", "http://localhost:4005"),
    "vectordb": ("VECTORDB_URL", "http://localhost:8010"),
}


def get_service_url(service: str) -> str:
    """Return URL for service. In production, require explicit env (no localhost default)."""
    entry = SERVICE_URL_MAP.get(service)
    if not entry:
        raise ValueError(f"Unknown service: {service}")
    key, default = entry
    val = (os.environ.get(key) or "").strip().rstrip("/")
    if val:
        return val
    if is_production():
        raise RuntimeError(f"Production requires {key} for service {service}")
    return default
