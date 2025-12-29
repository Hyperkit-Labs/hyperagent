"""
Contract interaction API

Allows users to call functions on deployed contracts
"""

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from web3 import Web3
try:
    from web3.exceptions import ContractLogicError, Web3ValidationError as ValidationError
except ImportError:
    from web3.exceptions import ContractLogicError, ValidationError

from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.services.gas_estimator import GasEstimator
from hyperagent.db.session import get_db
from hyperagent.models.deployment import Deployment
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contracts", tags=["contract-interaction"])


class ContractCallRequest(BaseModel):
    """Request to call a contract function"""
    contract_address: str = Field(..., description="Contract address")
    network: str = Field(..., description="Network where contract is deployed")
    function_name: str = Field(..., description="Function name to call")
    function_args: Optional[List[Any]] = Field(default=[], description="Function arguments")
    caller_address: Optional[str] = Field(None, description="Address calling the function")
    value: Optional[str] = Field(None, description="ETH value to send (in wei)")
    gas_limit: Optional[int] = Field(None, description="Gas limit (optional, will estimate if not provided)")


class ContractCallResponse(BaseModel):
    """Response from contract function call"""
    success: bool
    result: Optional[Any] = None
    transaction_hash: Optional[str] = None
    gas_used: Optional[int] = None
    error: Optional[str] = None


class ContractReadRequest(BaseModel):
    """Request to read from a contract (view/pure function)"""
    contract_address: str = Field(..., description="Contract address")
    network: str = Field(..., description="Network where contract is deployed")
    function_name: str = Field(..., description="Function name to call")
    function_args: Optional[List[Any]] = Field(default=[], description="Function arguments")
    abi: Optional[List[Dict[str, Any]]] = Field(None, description="Contract ABI (optional, will fetch from DB if not provided)")


class ContractReadResponse(BaseModel):
    """Response from contract read operation"""
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None


@router.post("/call", response_model=ContractCallResponse)
async def call_contract_function(
    request: ContractCallRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Call a contract function (write operation)
    
    This will create and send a transaction to the blockchain.
    Requires the caller to sign the transaction.
    """
    try:
        # Get contract ABI from database
        result = await db.execute(
            select(Deployment).where(
                Deployment.contract_address == request.contract_address.lower(),
                Deployment.deployment_network == request.network
            )
        )
        deployment = result.scalar_one_or_none()
        
        if not deployment:
            raise HTTPException(
                status_code=404,
                detail=f"Contract {request.contract_address} not found on {request.network}"
            )
        
        # Get contract ABI
        from hyperagent.models.contract import GeneratedContract
        contract_result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.id == deployment.contract_id)
        )
        contract = contract_result.scalar_one_or_none()
        
        if not contract or not contract.abi:
            raise HTTPException(
                status_code=404,
                detail="Contract ABI not found. Cannot call function."
            )
        
        abi = contract.abi
        
        # Initialize network manager and Web3
        network_manager = NetworkManager()
        w3 = network_manager.get_web3(request.network)
        
        # Create contract instance
        contract_instance = w3.eth.contract(
            address=Web3.to_checksum_address(request.contract_address),
            abi=abi
        )
        
        # Get function
        if not hasattr(contract_instance.functions, request.function_name):
            raise HTTPException(
                status_code=400,
                detail=f"Function '{request.function_name}' not found in contract ABI"
            )
        
        func = getattr(contract_instance.functions, request.function_name)
        
        # Build transaction
        tx_params = {}
        if request.caller_address:
            tx_params["from"] = Web3.to_checksum_address(request.caller_address)
        if request.value:
            tx_params["value"] = int(request.value)
        
        # Estimate gas if not provided
        if not request.gas_limit:
            gas_estimator = GasEstimator(network_manager)
            gas_result = await gas_estimator.estimate_function_call_gas(
                contract_address=request.contract_address,
                function_abi=next(
                    (item for item in abi if item.get("name") == request.function_name),
                    {}
                ),
                function_args=request.function_args or [],
                network=request.network,
                caller_address=request.caller_address,
            )
            tx_params["gas"] = gas_result["gas_estimate"]
        else:
            tx_params["gas"] = request.gas_limit
        
        # Build transaction
        try:
            transaction = func(*request.function_args).build_transaction(tx_params)
        except ContractLogicError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Contract logic error: {str(e)}"
            )
        except ValidationError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Validation error: {str(e)}"
            )
        
        # Return transaction for user to sign
        # In a full implementation, you would:
        # 1. Return unsigned transaction
        # 2. User signs in wallet
        # 3. Submit signed transaction
        # For now, we return the transaction data
        
        return ContractCallResponse(
            success=True,
            result={
                "transaction": transaction,
                "message": "Sign this transaction in your wallet and submit it to the blockchain"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to call contract function: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to call contract function: {str(e)}"
        )


@router.post("/read", response_model=ContractReadResponse)
async def read_contract_function(
    request: ContractReadRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Read from a contract (view/pure function)
    
    This is a read-only operation that doesn't require a transaction.
    """
    try:
        # Get contract ABI
        abi = request.abi
        if not abi:
            # Try to get from database
            result = await db.execute(
                select(Deployment).where(
                    Deployment.contract_address == request.contract_address.lower(),
                    Deployment.deployment_network == request.network
                )
            )
            deployment = result.scalar_one_or_none()
            
            if not deployment:
                raise HTTPException(
                    status_code=404,
                    detail=f"Contract {request.contract_address} not found on {request.network}"
                )
            
            from hyperagent.models.contract import GeneratedContract
            contract_result = await db.execute(
                select(GeneratedContract).where(GeneratedContract.id == deployment.contract_id)
            )
            contract = contract_result.scalar_one_or_none()
            
            if not contract or not contract.abi:
                raise HTTPException(
                    status_code=404,
                    detail="Contract ABI not found. Please provide ABI in request."
                )
            
            abi = contract.abi
        
        # Initialize network manager and Web3
        network_manager = NetworkManager()
        w3 = network_manager.get_web3(request.network)
        
        # Create contract instance
        contract_instance = w3.eth.contract(
            address=Web3.to_checksum_address(request.contract_address),
            abi=abi
        )
        
        # Get function
        if not hasattr(contract_instance.functions, request.function_name):
            raise HTTPException(
                status_code=400,
                detail=f"Function '{request.function_name}' not found in contract ABI"
            )
        
        func = getattr(contract_instance.functions, request.function_name)
        
        # Call function (read-only)
        try:
            result = func(*request.function_args).call()
            
            # Convert result to JSON-serializable format
            if isinstance(result, (list, tuple)):
                result = list(result)
            elif hasattr(result, '__iter__') and not isinstance(result, (str, bytes)):
                result = list(result)
            
            return ContractReadResponse(
                success=True,
                result=result
            )
        except ContractLogicError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Contract logic error: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error calling function: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read contract function: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read contract function: {str(e)}"
        )

