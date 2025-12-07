"""Deployment API routes"""

from typing import Any, Dict, List

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException

from hyperagent.agents.deployment import DeploymentAgent
from hyperagent.api.models import (
    BatchDeploymentRequest,
    BatchDeploymentResponse,
    BatchDeploymentResult,
    DeploymentRequest,
    DeploymentResponse,
)
from hyperagent.blockchain.alith_client import AlithClient
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.events.event_bus import EventBus

router = APIRouter(prefix="/api/v1/deployments", tags=["deployments"])


def get_deployment_service() -> DeploymentService:
    """Dependency to get DeploymentService instance"""
    network_manager = NetworkManager()
    alith_client = AlithClient()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=settings.private_key,
        use_authenticated=settings.eigenda_use_authenticated,
    )
    return DeploymentService(
        network_manager=network_manager,
        alith_client=alith_client,
        eigenda_client=eigenda_client,
        use_alith_autonomous=False,
        use_pef=True,  # Enable PEF by default for batch operations
    )


@router.post("/deploy", response_model=DeploymentResponse)
async def deploy_contract(request: DeploymentRequest) -> DeploymentResponse:
    """
    Deploy contract to blockchain

    Logic:
    1. Initialize deployment agent
    2. Validate compiled contract
    3. Deploy to network
    4. Wait for confirmation
    5. Return deployment info
    """
    # Initialize components
    network_manager = NetworkManager()
    alith_client = AlithClient()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=settings.private_key,
        use_authenticated=settings.eigenda_use_authenticated,
    )

    # Initialize Redis and EventBus (Redis is optional)
    redis_client = None
    if settings.redis_url:
        try:
            redis_client = await redis.from_url(settings.redis_url, decode_responses=True)
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
    event_bus = EventBus(redis_client)

    deployment_agent = DeploymentAgent(
        network_manager=network_manager,
        alith_client=alith_client,
        eigenda_client=eigenda_client,
        event_bus=event_bus,
    )

    # Deploy contract
    # Support both user wallet-based and server wallet deployments
    deployment_data = {
        "compiled_contract": request.compiled_contract,
        "network": request.network,
        "workflow_id": "",  # Optional
    }

    # Add deployment method based on what's provided
    if request.signed_transaction and request.wallet_address:
        # User wallet-based deployment
        deployment_data["signed_transaction"] = request.signed_transaction
        deployment_data["wallet_address"] = request.wallet_address
        deployment_data["use_gasless"] = request.use_gasless
    elif request.private_key:
        # Server wallet deployment (legacy)
        deployment_data["private_key"] = request.private_key
    else:
        # Try to use facilitator for x402 networks
        from hyperagent.core.config import settings

        enabled_networks = (
            [n.strip() for n in settings.x402_enabled_networks.split(",") if n.strip()]
            if settings.x402_enabled_networks
            else []
        )

        if request.network in enabled_networks and settings.x402_enabled:
            deployment_data["use_gasless"] = request.use_gasless or True
        else:
            raise HTTPException(
                status_code=400,
                detail="Either private_key, signed_transaction+wallet_address, or use_gasless must be provided",
            )

    result = await deployment_agent.process(deployment_data)

    return DeploymentResponse(
        contract_address=result["contract_address"],
        transaction_hash=result["tx_hash"],
        block_number=result["block_number"],
        gas_used=result["gas_used"],
        eigenda_commitment=result.get("eigenda_commitment"),
    )


@router.post("/batch", response_model=BatchDeploymentResponse)
async def deploy_batch(
    request: BatchDeploymentRequest,
    deployment_service: DeploymentService = Depends(get_deployment_service),
):
    """
    Deploy multiple contracts in parallel using Hyperion PEF

    Concept: Batch deployment with parallel execution
    Logic:
        1. Validate all contracts
        2. Use PEF for Hyperion networks (parallel execution)
        3. Fallback to sequential for other networks
        4. Return batch results

    Request:
    {
        "contracts": [
            {
                "compiled_contract": {...},
                "network": "hyperion_testnet",
                "contract_name": "Contract1",
                "source_code": "..." (optional, for dependency analysis)
            },
            ...
        ],
        "use_pef": true,
        "max_parallel": 10,
        "private_key": "..." (optional, uses settings if not provided)
    }
    """
    try:
        # Convert request contracts to internal format
        contracts = []
        for contract in request.contracts:
            contracts.append(
                {
                    "compiled_contract": contract.compiled_contract,
                    "contract_name": contract.contract_name or f"contract_{len(contracts)}",
                    "network": contract.network,
                    "source_code": contract.source_code,
                }
            )

        # Determine network (all contracts should use same network for batch)
        if contracts:
            network = contracts[0]["network"]
            # Validate all contracts use same network
            for contract in contracts[1:]:
                if contract["network"] != network:
                    raise HTTPException(
                        status_code=400, detail="All contracts in batch must use the same network"
                    )
        else:
            raise HTTPException(
                status_code=400, detail="At least one contract is required for batch deployment"
            )

        # Deploy batch
        result = await deployment_service.deploy_batch(
            contracts=contracts,
            network=network,
            use_pef=request.use_pef,
            max_parallel=request.max_parallel or 10,
            private_key=request.private_key or settings.private_key,
        )

        # Convert to response format
        deployment_results = [
            BatchDeploymentResult(
                contract_name=d["contract_name"],
                status=d["status"],
                contract_address=d.get("contract_address"),
                transaction_hash=d.get("transaction_hash"),
                block_number=d.get("block_number"),
                gas_used=d.get("gas_used"),
                error=d.get("error"),
            )
            for d in result["deployments"]
        ]

        return BatchDeploymentResponse(
            success=result["success"],
            deployments=deployment_results,
            total_time=result["total_time"],
            parallel_count=result.get("parallel_count", 0),
            success_count=result.get("success_count", 0),
            failed_count=result.get("failed_count", 0),
            batches_deployed=result.get("batches_deployed", 1),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch deployment failed: {str(e)}")
