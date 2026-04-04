"""Regression: production Docker stack must not expose orchestrator on the host."""

from __future__ import annotations

from pathlib import Path

import yaml


def _repo_root() -> Path:
    # services/orchestrator/tests/unit/<this_file> -> parents[4] = repo root
    return Path(__file__).resolve().parents[4]


def test_production_compose_orchestrator_not_host_bound():
    compose_path = _repo_root() / "infra" / "docker" / "docker-compose.yml"
    assert compose_path.is_file(), f"Missing {compose_path}"

    data = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    services = data.get("services") or {}
    orch = services.get("orchestrator") or {}
    ports = orch.get("ports")
    assert not ports, (
        "Production orchestrator must not publish host ports. "
        "Only api-gateway should be reachable from outside Docker; "
        "clients and proxies must use the gateway."
    )


def test_production_compose_api_gateway_has_public_port():
    compose_path = _repo_root() / "infra" / "docker" / "docker-compose.yml"
    data = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    gw = (data.get("services") or {}).get("api-gateway") or {}
    ports = gw.get("ports") or []
    assert ports, "api-gateway must publish at least one host port for ingress"
