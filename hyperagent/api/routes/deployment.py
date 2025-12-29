"""
Deployment API Routes for User-Signed Transactions
Handles deployment preparation and confirmation for wallet-signed deployments
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

from hyperagent.db.session import get_db
from hyperagent.models.workflow import Workflow
from hyperagent.models.deployment import Deployment
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.monitoring.metrics import deployments

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/workflows", tags=["deployment"])


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


@router.post("/{workflow_id}/deploy/prepare", response_model=DeploymentPrepareResponse)
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


@router.post("/{workflow_id}/deploy/confirm", response_model=DeploymentConfirmResponse)
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


@router.get("/{workflow_id}/deployments")
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

