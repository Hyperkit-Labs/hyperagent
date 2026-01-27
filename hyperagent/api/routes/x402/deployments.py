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
_deployment_service = DeploymentService(_network_manager, _eigenda_client)
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
    _request: UserOpDeploymentPrepareRequest,
    _http_request: Request,
    _db: AsyncSession = Depends(get_db),
):
    """ERC-4337 paymaster deployments are not supported in this release."""
    raise HTTPException(
        status_code=501,
        detail="ERC-4337/paymaster deployments are not supported in this release. Use signed_transaction deployment instead.",
    )


@router.post("/submit-user-op", response_model=DeploymentResponse)
async def submit_user_operation_deployment(_request: UserOpDeploymentSubmitRequest):
    """ERC-4337 paymaster deployments are not supported in this release."""
    raise HTTPException(
        status_code=501,
        detail="ERC-4337/paymaster deployments are not supported in this release.",
    )

