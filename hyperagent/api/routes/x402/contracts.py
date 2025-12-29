from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.models import ContractGenerationRequest, ContractGenerationResponse
# Import from contracts.py file directly (avoiding directory/package conflict)
# Use importlib to load the .py file directly
import importlib.util
import sys
from pathlib import Path

contracts_file_path = Path(__file__).parent.parent / "contracts.py"
spec = importlib.util.spec_from_file_location("contracts_routes", contracts_file_path)
contracts_routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contracts_routes)
_generate_contract_internal = contracts_routes._generate_contract_internal
from hyperagent.db.session import get_db

router = APIRouter(prefix="/api/v1/x402/contracts", tags=["x402-contracts"])
x402_middleware = X402Middleware()

PRICE_TIERS = {
    "ERC20": {"tier": "basic", "price": 0.01},
    "ERC721": {"tier": "basic", "price": 0.02},
    "Custom": {"tier": "advanced", "price": 0.15},
}


@router.post("/generate", response_model=ContractGenerationResponse)
async def generate_contract_with_payment(
    request: ContractGenerationRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    contract_type = request.contract_type or "Custom"
    tier_info = PRICE_TIERS.get(contract_type, PRICE_TIERS["Custom"])

    # Extract wallet address from headers (case-insensitive) or request body
    wallet_address = (
        http_request.headers.get("x-wallet-address")
        or http_request.headers.get("X-Wallet-Address")
        or getattr(request, "wallet_address", None)
    )
    merchant = "contract-generation"

    payment_response = await x402_middleware.verify_and_handle_payment(
        request=http_request,
        endpoint="/api/v1/x402/contracts/generate",
        price_tier=tier_info["tier"],
        price_usdc=tier_info["price"],
        network=request.network,
        db=db,
        wallet_address=wallet_address,
        merchant=merchant,
    )

    if payment_response is not None:
        return payment_response

    return await _generate_contract_internal(request, db)
