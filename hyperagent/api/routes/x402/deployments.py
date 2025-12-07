import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.models import (
    DeploymentPrepareRequest,
    DeploymentPrepareResponse,
    DeploymentRequest,
    DeploymentResponse,
)
from hyperagent.api.routes.deployments import deploy_contract as base_deploy_contract
from hyperagent.blockchain.alith_client import AlithClient
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.config import settings
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402/deployments", tags=["x402-deployments"])
x402_middleware = X402Middleware()

_network_manager = NetworkManager()
_alith_client = AlithClient()
_eigenda_client = EigenDAClient(
    disperser_url=settings.eigenda_disperser_url,
    private_key=settings.private_key,
    use_authenticated=settings.eigenda_use_authenticated,
)
_deployment_service = DeploymentService(_network_manager, _alith_client, _eigenda_client)


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
    return await base_deploy_contract(request)


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
