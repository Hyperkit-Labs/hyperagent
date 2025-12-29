import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.middleware.rate_limit import RateLimiter
from hyperagent.api.models import (
    DeploymentPrepareRequest,
    DeploymentPrepareResponse,
    DeploymentRequest,
    DeploymentResponse,
    UserOpDeploymentPrepareRequest,
    UserOpDeploymentPrepareResponse,
    UserOpDeploymentSubmitRequest,
)
from hyperagent.api.routes.deployments import deploy_contract as base_deploy_contract
from hyperagent.blockchain.alith_client import AlithClient
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.erc4337 import ERC4337AccountAbstraction
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.core.services.deployment.erc4337_deployment import ERC4337DeploymentHelper
from hyperagent.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402/deployments", tags=["x402-deployments"])
x402_middleware = X402Middleware()

# Initialize rate limiter
_redis_manager = None
if settings.redis_url:
    try:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        _redis_manager = RedisManager(_redis_client)
    except Exception as e:
        logger.warning(f"Failed to connect to Redis for rate limiting: {e}")

rate_limiter = RateLimiter(_redis_manager)

_network_manager = NetworkManager()
_alith_client = AlithClient()
# Initialize with SecretsManager (lazy initialization)
_eigenda_client = None

async def get_eigenda_client():
    """Get EigenDA client with secure private key"""
    global _eigenda_client
    if _eigenda_client is None:
        from hyperagent.security.secrets import SecretsManager
        secrets_manager = SecretsManager()
        server_private_key = await secrets_manager.get_server_wallet_key()
_eigenda_client = EigenDAClient(
    disperser_url=settings.eigenda_disperser_url,
            private_key=server_private_key,
    use_authenticated=settings.eigenda_use_authenticated,
)
    return _eigenda_client
_deployment_service = DeploymentService(_network_manager, _alith_client, _eigenda_client)
_erc4337_helper = ERC4337DeploymentHelper(_network_manager)
_erc4337 = ERC4337AccountAbstraction(_network_manager)


def is_x402_network(network: str) -> bool:
    from hyperagent.blockchain.network_features import NetworkFeatureManager

    return NetworkFeatureManager.is_x402_network(
        network, settings.x402_enabled, settings.x402_enabled_networks
    )


@router.post("/deploy", response_model=DeploymentResponse)
async def deploy_with_payment(
    request: DeploymentRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    if not is_x402_network(request.network):
        logger.info(f"Network {request.network} not x402-enabled, bypassing payment")
        return await base_deploy_contract(request)

    # Extract wallet address from headers (case-insensitive) or request body
    wallet_address = (
        request.wallet_address
        or http_request.headers.get("x-wallet-address")
        or http_request.headers.get("X-Wallet-Address")
    )
    
    if not wallet_address:
        raise HTTPException(status_code=400, detail="Wallet address required")
    
    # Check deployment rate limits
    allowed, error_message = await rate_limiter.check_deployment_rate_limit(
        wallet_address, request.network
    )
    if not allowed:
        raise HTTPException(status_code=429, detail=error_message)
    
    merchant = "deployment"

    payment_response = await x402_middleware.verify_and_handle_payment(
        request=http_request,
        endpoint="/api/v1/x402/deployments/deploy",
        price_tier="deployment",
        price_usdc=0.10,
        network=request.network,
        db=db,
        wallet_address=wallet_address,
        merchant=merchant,
    )

    if payment_response is not None:
        return payment_response

    logger.info(f"Payment verified, deploying to {request.network}")
    
    # Deploy contract
    result = await base_deploy_contract(request)
    
    # Increment rate limit counters after successful deployment
    await rate_limiter.increment_deployment(wallet_address, request.network)
    
    return result


@router.post("/prepare", response_model=DeploymentPrepareResponse)
async def prepare_deployment(
    request: DeploymentPrepareRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    if is_x402_network(request.network):
        # Extract wallet address from headers (case-insensitive) or request body
        wallet_address = (
            request.wallet_address
            or http_request.headers.get("x-wallet-address")
            or http_request.headers.get("X-Wallet-Address")
        )
        merchant = "deployment-prepare"

        payment_response = await x402_middleware.verify_and_handle_payment(
            request=http_request,
            endpoint="/api/v1/x402/deployments/prepare",
            price_tier="deployment",
            price_usdc=0.10,
            network=request.network,
            db=db,
            wallet_address=wallet_address,
            merchant=merchant,
        )

        if payment_response is not None:
            return payment_response

    try:
        transaction_data = await _deployment_service.prepare_deployment_transaction(
            compiled_contract=request.compiled_contract,
            network=request.network,
            wallet_address=request.wallet_address,
            constructor_args=request.constructor_args,
        )

        logger.info(
            f"Prepared deployment transaction for {request.wallet_address} on {request.network}"
        )

        return DeploymentPrepareResponse(
            transaction_data=transaction_data,
            network=request.network,
            wallet_address=request.wallet_address,
            message="Sign this transaction in your wallet, then send the signed transaction to /api/v1/x402/deployments/deploy endpoint with signed_transaction field.",
        )
    except Exception as e:
        logger.error(f"Failed to prepare deployment transaction: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to prepare deployment transaction: {str(e)}"
        )


@router.post("/prepare-user-op", response_model=UserOpDeploymentPrepareResponse)
async def prepare_user_operation_deployment(
    request: UserOpDeploymentPrepareRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Prepare UserOperation for user-signed ERC-4337 deployment
    
    Flow:
    1. Verify x402 payment
    2. Check if user address is Smart Account
    3. Prepare UserOperation with paymaster sponsorship
    4. Return for user to sign
    """
    if not is_x402_network(request.network):
        raise HTTPException(
            status_code=400,
            detail=f"Network {request.network} does not support ERC-4337 deployments"
        )
    
    # Extract wallet address from headers or request
    wallet_address = (
        request.wallet_address
        or http_request.headers.get("x-wallet-address")
        or http_request.headers.get("X-Wallet-Address")
    )
    
    if not wallet_address:
        raise HTTPException(status_code=400, detail="Wallet address required")
    
    # Verify payment first
    payment_response = await x402_middleware.verify_and_handle_payment(
        request=http_request,
        endpoint="/api/v1/x402/deployments/prepare-user-op",
        price_tier="deployment",
        price_usdc=0.10,
        network=request.network,
        db=db,
        wallet_address=wallet_address,
        merchant="deployment-user-op",
    )
    
    if payment_response is not None:
        return payment_response
    
    # Check if address is Smart Account
    is_smart = await _erc4337.is_smart_account(
        request.user_smart_account, request.network
    )
    
    if not is_smart:
        raise HTTPException(
            status_code=400,
            detail=f"Address {request.user_smart_account} is not a Smart Account. Use /deploy endpoint for EOA deployments."
        )
    
    # Prepare UserOperation with paymaster sponsorship
    try:
        result = await _erc4337_helper.prepare_deployment_user_operation(
            request.user_smart_account,
            request.compiled_contract.model_dump(),
            request.network
        )
        
        logger.info(
            f"UserOperation prepared for Smart Account {request.user_smart_account} on {request.network}"
        )
        
        return UserOpDeploymentPrepareResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to prepare UserOperation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to prepare UserOperation: {str(e)}"
        )


@router.post("/submit-user-op", response_model=DeploymentResponse)
async def submit_user_operation_deployment(
    request: UserOpDeploymentSubmitRequest
):
    """
    Submit user-signed UserOperation to EntryPoint
    
    Flow:
    1. Validate signature
    2. Submit to EntryPoint
    3. Wait for confirmation
    4. Return contract address
    """
    if not is_x402_network(request.network):
        raise HTTPException(
            status_code=400,
            detail=f"Network {request.network} does not support ERC-4337 deployments"
        )
    
    try:
        result = await _erc4337_helper.submit_signed_user_operation(
            request.signed_user_op,
            request.network
        )
        
        logger.info(
            f"UserOperation submitted successfully. Contract: {result['contract_address']}"
        )
        
        return DeploymentResponse(**result)
        
    except Exception as e:
        logger.error(f"Failed to submit UserOperation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit UserOperation: {str(e)}"
        )

