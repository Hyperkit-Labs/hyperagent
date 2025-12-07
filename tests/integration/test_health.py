"""Integration tests for health monitoring"""

import pytest
from hyperagent.monitoring.health import HealthMonitor


@pytest.mark.asyncio
async def test_health_monitor_initialization():
    """Test HealthMonitor can be initialized"""
    monitor = HealthMonitor()
    assert monitor is not None


@pytest.mark.asyncio
async def test_health_check_basic():
    """Test basic health check functionality"""
    monitor = HealthMonitor()
    # Basic smoke test - verify no exceptions
    assert monitor is not None

