"""
End-to-end tests for workflow creation and execution
"""

import pytest
from httpx import AsyncClient
from hyperagent.api.main import app


@pytest.mark.asyncio
async def test_create_workflow_basic():
    """Test basic workflow creation"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple ERC20 token with 1 million supply",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        assert response.status_code in [200, 201, 202]  # Accept various success codes
        data = response.json()
        assert "workflow_id" in data
        assert data["status"] in ["created", "pending", "processing"]


@pytest.mark.asyncio
async def test_create_workflow_with_tasks():
    """Test workflow creation with selected tasks"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple ERC20 token",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890",
                "selected_tasks": ["generation", "compilation"]
            }
        )
        
        assert response.status_code in [200, 201, 202]
        data = response.json()
        assert "workflow_id" in data


@pytest.mark.asyncio
async def test_get_workflow_status():
    """Test retrieving workflow status"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # First create a workflow
        create_response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple ERC20 token",
                "network": "mantle_testnet",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        assert create_response.status_code in [200, 201, 202]
        workflow_id = create_response.json()["workflow_id"]
        
        # Then get its status
        status_response = await client.get(f"/api/v1/workflows/{workflow_id}")
        assert status_response.status_code == 200
        data = status_response.json()
        assert "workflow_id" in data
        assert "status" in data


@pytest.mark.asyncio
async def test_list_workflows():
    """Test listing all workflows"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/workflows")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, (list, dict))  # Could be list or paginated response


@pytest.mark.asyncio
async def test_create_workflow_missing_wallet():
    """Test workflow creation fails without wallet address"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple ERC20 token",
                "network": "mantle_testnet"
                # Missing wallet_address
            }
        )
        
        # Should return validation error
        assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_create_workflow_invalid_network():
    """Test workflow creation with invalid network"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create a simple ERC20 token",
                "network": "invalid_network",
                "wallet_address": "0x1234567890123456789012345678901234567890"
            }
        )
        
        # Should return validation error or handle gracefully
        assert response.status_code in [400, 422, 500]

