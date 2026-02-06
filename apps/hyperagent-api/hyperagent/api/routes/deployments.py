"""Deployment API routes"""

import logging
from typing import Any, Dict, List, Optional

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

# DEPRECATED: Use DeploymentService instead
# from hyperagent.agents.deployment import DeploymentAgent
from hyperagent.api.models import (
    BatchDeploymentRequest,
    BatchDeploymentResponse,
    BatchDeploymentResult,
    DeploymentRequest,
    DeploymentResponse,
)
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.db.session import get_db
from hyperagent.events.event_bus import EventBus
from hyperagent.models.deployment import Deployment
from hyperagent.models.workflow import Workflow
from hyperagent.monitoring.metrics import deployments
from hyperagent.security.secrets import SecretsManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/deployments", tags=["deployments"])
workflow_router = APIRouter(prefix="/api/v1/workflows", tags=["deployment"])


async def get_deployment_service() -> DeploymentService:
    """Dependency to get DeploymentService instance"""
    secrets_manager = SecretsManager()
    server_private_key = await secrets_manager.get_server_wallet_key()
    
    network_manager = NetworkManager()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=server_private_key,
        use_authenticated=settings.eigenda_use_authenticated,
    )
    return DeploymentService(
        network_manager=network_manager,
        eigenda_client=eigenda_client,
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
    # Initialize components with SecretsManager
    secrets_manager = SecretsManager()
    server_private_key = await secrets_manager.get_server_wallet_key()
    
    network_manager = NetworkManager()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=server_private_key,
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

    # Use DeploymentService instead of DeploymentAgent
    deployment_service = DeploymentService(
        network_manager=network_manager,
        eigenda_client=eigenda_client,
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

    result = await deployment_service.process(deployment_data)

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
    Deploy multiple contracts with best-effort parallelism

    Concept: Batch deployment with optional parallel execution
    Logic:
        1. Validate all contracts
        2. Deploy in parallel if requested (best-effort)
        3. Return batch results

    Request:
    {
        "contracts": [
            {
                "compiled_contract": {...},
                "network": "mantle_testnet",
                "contract_name": "Contract1",
                "source_code": "..." (optional, for dependency analysis)
            },
            ...
        ],
        "parallel": true,
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
        # Get server private key from SecretsManager
        secrets_manager = SecretsManager()
        server_private_key = await secrets_manager.get_server_wallet_key()
        
        result = await deployment_service.deploy_batch(
            contracts=contracts,
            network=network,
            parallel=request.parallel,
            max_parallel=request.max_parallel or 10,
            private_key=request.private_key or server_private_key,
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


# Workflow-specific deployment endpoints (merged from deployment.py)
class DeploymentPrepareRequest(BaseModel):
    """Request to prepare deployment transaction"""
    wallet_address: str = Field(..., description="User wallet address for deployment")
    network: str = Field(..., description="Target blockchain network")
    constructor_args: Optional[list] = Field(default=None, description="Constructor arguments")


class DeploymentPrepareResponse(BaseModel):
    """Response with deployment transaction data"""
    deployment_id: str
    bytecode: str
    abi: list
    gas_estimate: int
    network: str
    constructor_data: Optional[str] = None


class DeploymentConfirmRequest(BaseModel):
    """Request to confirm deployment"""
    tx_hash: str = Field(..., description="Transaction hash from blockchain")
    network: str = Field(..., description="Network where contract was deployed")


class DeploymentConfirmResponse(BaseModel):
    """Response with confirmed deployment"""
    deployment_id: str
    contract_address: str
    tx_hash: str
    status: str


@workflow_router.post("/{workflow_id}/deploy/prepare", response_model=DeploymentPrepareResponse)
async def prepare_deployment(
    workflow_id: str,
    request: DeploymentPrepareRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Prepare deployment transaction for user to sign
    
    Flow:
    1. Retrieve workflow and compiled contract
    2. Estimate gas for deployment
    3. Create pending deployment record
    4. Return deployment data for wallet signing
    """
    try:
        # Get workflow
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if workflow.status != "completed":
            raise HTTPException(
                status_code=400,
                detail=f"Workflow must be completed before deployment. Current status: {workflow.status}"
            )
        
        # Get contracts from workflow using a separate query
        from hyperagent.models.contract import GeneratedContract
        
        contracts_result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.workflow_id == workflow.id)
        )
        contracts = contracts_result.scalars().all()
        
        if not contracts or len(contracts) == 0:
            raise HTTPException(
                status_code=400,
                detail="No compiled contract found for this workflow"
            )
        
        contract = contracts[0]
        
        # Validate bytecode
        if not contract.bytecode:
            raise HTTPException(
                status_code=400,
                detail="Contract has no bytecode. Compilation may have failed."
            )
        
        # Estimate gas using GasEstimator service
        from hyperagent.core.services.gas_estimator import GasEstimator
        
        gas_estimator = GasEstimator()
        gas_result = await gas_estimator.estimate_deployment_gas(
            bytecode=contract.bytecode,
            network=request.network,
            constructor_args=request.constructor_args,
            deployer_address=request.wallet_address,
        )
        gas_estimate = gas_result["gas_estimate"]
        
        # Create pending deployment record using correct field names
        # Use unique random values for placeholders to avoid constraint violations
        import secrets
        placeholder_address = f"0x{secrets.token_hex(20)}"  # Unique address placeholder
        placeholder_tx = f"0x{secrets.token_hex(32)}"  # Unique tx placeholder
        
        deployment = Deployment(
            deployment_network=request.network,
            is_testnet=True,  # Assuming testnet for now
            contract_address=placeholder_address,
            deployer_address=request.wallet_address,
            transaction_hash=placeholder_tx,
            gas_used=gas_estimate,
        )
        deployment.contract_id = contract.id  # Set via attribute
        
        db.add(deployment)
        await db.commit()
        await db.refresh(deployment)
        
        logger.info(
            f"Prepared deployment {deployment.id} for workflow {workflow.id}"
        )
        
        # Prepare constructor data if needed
        constructor_data = None
        if request.constructor_args:
            from web3 import Web3
            w3 = Web3()
            
            # Find constructor ABI
            constructor_abi = next(
                (item for item in contract.abi if item.get('type') == 'constructor'),
                None
            )
            
            if constructor_abi:
                contract_interface = w3.eth.contract(abi=[constructor_abi])
                constructor_data = contract_interface.constructor(*request.constructor_args).data_in_transaction
        
        return DeploymentPrepareResponse(
            deployment_id=str(deployment.id),
            bytecode=contract.bytecode,
            abi=contract.abi or [],
            gas_estimate=gas_estimate,
            network=request.network,
            constructor_data=constructor_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to prepare deployment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to prepare deployment: {str(e)}"
        )


@workflow_router.post("/{workflow_id}/deploy/confirm", response_model=DeploymentConfirmResponse)
async def confirm_deployment(
    workflow_id: str,
    request: DeploymentConfirmRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Confirm deployment and extract contract address from transaction
    
    Flow:
    1. Find pending deployment
    2. Check transaction on blockchain
    3. Extract contract address from receipt
    4. Update deployment status
    5. Increment metrics
    """
    try:
        # Get workflow
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Get pending deployment
        result = await db.execute(
            select(Deployment)
            .where(Deployment.contract_id == workflow.id)
            .order_by(Deployment.created_at.desc())
        )
        deployment = result.scalar_one_or_none()
        
        if not deployment:
            raise HTTPException(
                status_code=404,
                detail="No pending deployment found for this workflow"
            )
        
        # Initialize deployment service
        deployment_service = DeploymentService()
        
        # Get transaction receipt and extract contract address
        try:
            contract_address = await deployment_service.get_contract_address_from_tx(
                tx_hash=request.tx_hash,
                network=request.network
            )
        except Exception as e:
            logger.error(f"Error getting contract address: {e}")
            # Try direct Web3 query as fallback
            from web3 import Web3
            from hyperagent.blockchain.networks import NetworkManager
            
            network_manager = NetworkManager()
            w3 = network_manager.get_web3(request.network)
            
            if not request.tx_hash.startswith('0x'):
                tx_hash = f'0x{request.tx_hash}'
            else:
                tx_hash = request.tx_hash
                
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            contract_address = receipt.get('contractAddress') if receipt else None
        
        if not contract_address:
            raise HTTPException(
                status_code=400,
                detail="Transaction not found or not mined yet. Please try again."
            )
        
        # Update deployment
        deployment.contract_address = contract_address
        deployment.transaction_hash = request.tx_hash
        
        await db.commit()
        await db.refresh(deployment)
        
        logger.info(
            f"Confirmed deployment {deployment.id}: "
            f"contract at {contract_address}, tx {request.tx_hash}"
        )
        
        return DeploymentConfirmResponse(
            deployment_id=str(deployment.id),
            contract_address=contract_address,
            tx_hash=request.tx_hash,
            status="deployed"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to confirm deployment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to confirm deployment: {str(e)}"
        )


@workflow_router.get("/{workflow_id}/deployments")
async def list_deployments(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all deployments for a workflow"""
    try:
        result = await db.execute(
            select(Deployment)
            .where(Deployment.workflow_id == workflow_id)
            .order_by(Deployment.created_at.desc())
        )
        deployments_list = result.scalars().all()
        
        return {
            "workflow_id": workflow_id,
            "deployments": [
                {
                    "deployment_id": d.deployment_id,
                    "network": d.network,
                    "contract_address": d.contract_address,
                    "tx_hash": d.tx_hash,
                    "status": d.status,
                    "deployer_address": d.deployer_address,
                    "gas_used": d.gas_used,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in deployments_list
            ]
        }
    except Exception as e:
        logger.error(f"Failed to list deployments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list deployments: {str(e)}"
        )
