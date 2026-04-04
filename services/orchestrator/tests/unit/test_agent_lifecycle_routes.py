"""Agent registry + A2A routers are mounted (no DB calls)."""

from __future__ import annotations

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_agent_lifecycle_paths_on_app() -> None:
    from main import app

    paths = [getattr(r, "path", "") for r in app.routes]
    assert "/api/v1/agent-registry/agents" in paths
    assert "/api/v1/a2a/tasks" in paths
    assert "/api/v1/erc8004/sync" in paths
    assert "/api/v1/erc8004/agents/{agent_id}" in paths
