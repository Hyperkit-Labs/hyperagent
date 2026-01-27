"""
Integration tests for modular pay-per-task model

Tests task selection, cost calculation, payment verification,
workflow execution, and network selection.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.main import app
from hyperagent.billing.cost_estimator import CostEstimator
from hyperagent.core.orchestrator import WorkflowCoordinator
from hyperagent.blockchain.network_registry import NetworkRegistry


@pytest.fixture
def client(monkeypatch):
    """Create test client with DB dependency overridden (no external Postgres required)"""
    import uuid
    from unittest.mock import AsyncMock

    from hyperagent.db.session import get_db
    from hyperagent.models.user import User

    # Prevent background workflow execution from trying to open a real DB session
    import hyperagent.api.routes.workflows as workflows_routes

    workflows_routes.execute_workflow_background = AsyncMock(return_value=None)

    dummy_user = User(email="default@hyperagent.local", username=None, is_active=True)
    dummy_user.id = uuid.uuid4()

    class _Result:
        def __init__(self, scalar):
            self._scalar = scalar

        def scalar_one_or_none(self):
            return self._scalar

        def scalars(self):
            return self

        def all(self):
            return []

    class DummySession:
        async def execute(self, *args, **kwargs):
            return _Result(dummy_user)

        def add(self, *args, **kwargs):
            return None

        async def flush(self, *args, **kwargs):
            return None

        async def commit(self, *args, **kwargs):
            return None

        async def refresh(self, *args, **kwargs):
            return None

        async def rollback(self, *args, **kwargs):
            return None

    async def override_get_db():
        yield DummySession()

    app.dependency_overrides[get_db] = override_get_db

    return TestClient(app)


@pytest.fixture
def cost_estimator():
    """Create cost estimator instance"""
    return CostEstimator()


class TestTaskCostCalculation:
    """Test task-based cost calculation"""

    def test_calculate_single_task_cost(self, cost_estimator):
        """Test cost calculation for single task"""
        result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            model="gemini-2.5-flash",
            contract_complexity="standard",
            prompt_length=100,
        )

        assert result["total_usdc"] > 0
        assert "generation" in result["breakdown"]
        assert result["selected_tasks"] == ["generation"]
        assert result["network"] == "avalanche_fuji"

    def test_calculate_multiple_tasks_cost(self, cost_estimator):
        """Test cost calculation for multiple tasks"""
        result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation", "audit", "testing"],
            network="avalanche_fuji",
            model="gemini-2.5-flash",
            contract_complexity="standard",
        )

        assert result["total_usdc"] > 0
        assert len(result["breakdown"]) == 3
        assert "generation" in result["breakdown"]
        assert "audit" in result["breakdown"]
        assert "testing" in result["breakdown"]
        assert result["selected_tasks"] == ["generation", "audit", "testing"]

    def test_cost_with_network_multiplier(self, cost_estimator):
        """Test cost calculation with network multiplier"""
        fuji_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            model="gemini-2.5-flash",
        )

        mainnet_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_mainnet",
            model="gemini-2.5-flash",
        )

        # Mainnet should be more expensive
        assert mainnet_result["total_usdc"] >= fuji_result["total_usdc"]
        assert mainnet_result["network_multiplier"] > fuji_result["network_multiplier"]

    def test_cost_with_model_multiplier(self, cost_estimator):
        """Test cost calculation with model multiplier"""
        flash_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            model="gemini-2.5-flash",
        )

        opus_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            model="claude-opus-4.5",
        )

        # Opus should be more expensive
        assert opus_result["total_usdc"] >= flash_result["total_usdc"]
        assert opus_result["model_multiplier"] > flash_result["model_multiplier"]

    def test_cost_with_complexity_multiplier(self, cost_estimator):
        """Test cost calculation with complexity multiplier"""
        simple_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            contract_complexity="simple",
        )

        complex_result = cost_estimator.calculate_task_cost(
            selected_tasks=["generation"],
            network="avalanche_fuji",
            contract_complexity="complex",
        )

        # Complex should be more expensive
        assert complex_result["total_usdc"] >= simple_result["total_usdc"]


class TestCostEstimationEndpoint:
    """Test cost estimation API endpoint"""

    def test_estimate_cost_endpoint(self, client):
        """Test POST /api/v1/workflows/estimate-cost"""
        response = client.post(
            "/api/v1/workflows/estimate-cost",
            json={
                "selected_tasks": ["generation", "audit"],
                "network": "avalanche_fuji",
                "model": "gemini-2.5-flash",
                "contract_complexity": "standard",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_usdc" in data
        assert "breakdown" in data
        assert "selected_tasks" in data
        assert data["selected_tasks"] == ["generation", "audit"]
        assert data["total_usdc"] > 0

    def test_estimate_cost_invalid_tasks(self, client):
        """Test cost estimation with invalid tasks"""
        response = client.post(
            "/api/v1/workflows/estimate-cost",
            json={
                "selected_tasks": ["invalid_task"],
                "network": "avalanche_fuji",
            },
        )

        assert response.status_code in [400, 422]

    def test_estimate_cost_empty_tasks(self, client):
        """Test cost estimation with empty task list"""
        response = client.post(
            "/api/v1/workflows/estimate-cost",
            json={
                "selected_tasks": [],
                "network": "avalanche_fuji",
            },
        )

        assert response.status_code in [400, 422]


class TestWorkflowTaskSelection:
    """Test workflow creation with task selection"""

    def test_create_workflow_with_selected_tasks(self, client):
        """Test workflow creation with selected tasks"""
        response = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC20 token named TestToken",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "selected_tasks": ["generation", "audit"],
            },
        )

        # Should accept request (may require payment for x402 networks)
        assert response.status_code in [200, 201, 402]

    def test_create_workflow_backward_compatibility(self, client):
        """Test workflow creation with skip flags (backward compatibility)"""
        response = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC20 token named TestToken",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "skip_audit": True,
                "skip_deployment": True,
            },
        )

        # Should accept request and convert skip flags to selected_tasks
        assert response.status_code in [200, 201, 402]

    def test_create_workflow_single_task(self, client):
        """Test workflow creation with only generation task"""
        response = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC20 token named TestToken",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "selected_tasks": ["generation"],
            },
        )

        assert response.status_code in [200, 201, 402]


class TestNetworkSelection:
    """Test network selection and pagination"""

    @pytest.mark.asyncio
    async def test_list_networks_pagination(self):
        """Test network listing with pagination"""
        registry = NetworkRegistry()
        result = await registry.list_networks(page=1, limit=10)

        assert "networks" in result
        assert "total" in result
        assert "page" in result
        assert "limit" in result
        assert "has_next" in result
        assert "has_prev" in result
        assert len(result["networks"]) <= 10

    @pytest.mark.asyncio
    async def test_search_networks(self):
        """Test network search functionality"""
        registry = NetworkRegistry()
        results = await registry.search_networks("avalanche")

        assert isinstance(results, list)
        assert all("network" in net for net in results)
        assert all("avalanche" in net["network"].lower() for net in results)

    @pytest.mark.asyncio
    async def test_filter_networks_by_features(self):
        """Test network filtering by features"""
        registry = NetworkRegistry()
        result = await registry.list_networks(
            page=1,
            limit=50,
            filters={"features": ["x402"]},
        )

        assert "networks" in result
        # All returned networks should support x402
        for net in result["networks"]:
            assert net.get("supports_x402", False) or "x402" in str(net.get("features", {}))

    def test_network_api_pagination(self, client):
        """Test network API endpoint with pagination"""
        response = client.get("/api/v1/networks?page=1&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert "networks" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert len(data["networks"]) <= 10

    def test_network_api_search(self, client):
        """Test network API endpoint with search"""
        response = client.get("/api/v1/networks?search=avalanche")

        assert response.status_code == 200
        data = response.json()
        assert "networks" in data
        # All results should contain "avalanche" in name or network
        for net in data["networks"]:
            network_str = f"{net.get('network', '')} {net.get('name', '')}".lower()
            assert "avalanche" in network_str

    def test_network_api_feature_filter(self, client):
        """Test network API endpoint with feature filter"""
        response = client.get("/api/v1/networks?features=x402")

        assert response.status_code == 200
        data = response.json()
        assert "networks" in data


class TestWorkflowExecutionWithTasks:
    """Test workflow execution with selected tasks"""

    @pytest.mark.asyncio
    async def test_workflow_coordinator_builds_pipeline_from_tasks(self):
        """Test that WorkflowCoordinator builds pipeline based on selected tasks"""
        from hyperagent.architecture.soa import ServiceRegistry
        from hyperagent.events.event_bus import EventBus

        service_registry = ServiceRegistry()
        event_bus = EventBus()

        coordinator = WorkflowCoordinator(service_registry, event_bus)

        # Test pipeline building for selected tasks
        pipeline = coordinator._build_pipeline_from_tasks(
            selected_tasks=["generation", "audit"],
            nlp_input="Test",
            network="avalanche_fuji",
            workflow_id="test-123",
            wallet_address="0x1234567890123456789012345678901234567890",
            use_gasless=False,
            signed_transaction=None,
            rag_context="",
            plan_timeouts={},
            rag_metadata={},
        )

        assert len(pipeline) == 2
        assert pipeline[0]["service"] == "generation"
        assert pipeline[1]["service"] == "audit"

    @pytest.mark.asyncio
    async def test_workflow_coordinator_progress_calculation(self):
        """Test dynamic progress calculation for selected tasks"""
        from hyperagent.architecture.soa import ServiceRegistry
        from hyperagent.events.event_bus import EventBus

        service_registry = ServiceRegistry()
        event_bus = EventBus()

        coordinator = WorkflowCoordinator(service_registry, event_bus)

        # Test progress ranges for 2 tasks
        progress_ranges = coordinator._calculate_progress_ranges(["generation", "audit"])

        assert "generation" in progress_ranges
        assert "audit" in progress_ranges
        assert progress_ranges["generation"][0] == 0
        assert progress_ranges["generation"][1] == 50
        assert progress_ranges["audit"][0] == 50
        assert progress_ranges["audit"][1] == 100

    @pytest.mark.asyncio
    async def test_workflow_coordinator_task_dependencies(self):
        """Test that task dependencies are automatically added"""
        from hyperagent.architecture.soa import ServiceRegistry
        from hyperagent.events.event_bus import EventBus

        service_registry = ServiceRegistry()
        event_bus = EventBus()

        coordinator = WorkflowCoordinator(service_registry, event_bus)

        # Request audit without generation - should auto-add generation
        pipeline = coordinator._build_pipeline_from_tasks(
            selected_tasks=["audit"],
            nlp_input="Test",
            network="avalanche_fuji",
            workflow_id="test-123",
            wallet_address="0x1234567890123456789012345678901234567890",
            use_gasless=False,
            signed_transaction=None,
            rag_context="",
            plan_timeouts={},
            rag_metadata={},
        )

        # Should include both generation and audit
        service_names = [stage["service"] for stage in pipeline]
        assert "generation" in service_names
        assert "audit" in service_names


class TestX402PaymentWithTasks:
    """Test x402 payment verification with task breakdown"""

    def test_x402_middleware_accepts_cost_breakdown(self, client):
        """Test that x402 middleware accepts cost breakdown"""
        # This test verifies the middleware signature accepts the new parameters
        # Actual payment verification requires wallet connection
        from hyperagent.api.middleware.x402 import X402Middleware

        middleware = X402Middleware()
        assert hasattr(middleware, "verify_and_handle_payment")

        # Check method signature includes new parameters
        import inspect

        sig = inspect.signature(middleware.verify_and_handle_payment)
        assert "selected_tasks" in sig.parameters
        assert "cost_breakdown" in sig.parameters


class TestBackwardCompatibility:
    """Test backward compatibility with skip flags"""

    def test_skip_flags_converted_to_selected_tasks(self, client):
        """Test that skip flags are converted to selected_tasks"""
        response = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC20 token",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "skip_audit": True,
                "skip_testing": True,
                "skip_deployment": False,
            },
        )

        # Should accept and convert skip flags
        assert response.status_code in [200, 201, 402]

    def test_selected_tasks_overrides_skip_flags(self, client):
        """Test that selected_tasks takes precedence over skip flags"""
        response = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC20 token",
                "network": "avalanche_fuji",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "selected_tasks": ["generation", "deployment"],
                "skip_audit": False,  # Should be ignored
                "skip_deployment": True,  # Should be ignored
            },
        )

        # selected_tasks should take precedence
        assert response.status_code in [200, 201, 402]


@pytest.mark.asyncio
class TestNetworkRegistry:
    """Test NetworkRegistry service"""

    async def test_get_network_with_fallback(self):
        """Test network retrieval with fallback chain"""
        registry = NetworkRegistry()
        config = await registry.get_network("avalanche_fuji")

        assert config is not None
        assert "chain_id" in config or "features" in config

    async def test_list_networks_pagination(self):
        """Test paginated network listing"""
        registry = NetworkRegistry()
        result = await registry.list_networks(page=1, limit=5)

        assert "networks" in result
        assert len(result["networks"]) <= 5
        assert result["page"] == 1
        assert result["limit"] == 5

    async def test_search_networks(self):
        """Test network search"""
        registry = NetworkRegistry()
        results = await registry.search_networks("mantle")

        assert isinstance(results, list)
        assert all("network" in net for net in results)

    async def test_filter_networks_by_x402(self):
        """Test filtering networks by x402 support"""
        registry = NetworkRegistry()
        result = await registry.list_networks(
            page=1,
            limit=50,
            filters={"x402_enabled": True},
        )

        assert "networks" in result
        for net in result["networks"]:
            assert net.get("supports_x402", False)

