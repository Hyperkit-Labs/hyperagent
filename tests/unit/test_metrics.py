"""Unit tests for monitoring metrics"""

import pytest
from hyperagent.monitoring.metrics import MetricsCollector, workflow_created, agent_executions


def test_workflow_created_counter():
    """Test workflow created counter initialization"""
    assert workflow_created is not None
    assert workflow_created._name == "hyperagent_workflows_created_total"


def test_agent_executions_counter():
    """Test agent executions counter initialization"""
    assert agent_executions is not None
    assert agent_executions._name == "hyperagent_agent_executions_total"


def test_metrics_collector_track_workflow():
    """Test MetricsCollector.track_workflow method"""
    MetricsCollector.track_workflow("hyperion_testnet", "ERC20")
    # Verify no exceptions raised
    assert True


def test_metrics_collector_track_agent_execution():
    """Test MetricsCollector.track_agent_execution method"""
    MetricsCollector.track_agent_execution("generation", 1.5, True)
    # Verify no exceptions raised
    assert True

