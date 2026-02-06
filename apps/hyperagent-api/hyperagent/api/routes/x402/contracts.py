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

# Price tiers are now loaded from config/pricing.yaml
def get_price_tier_info(contract_type: str) -> dict:
    """Get price tier info from config/pricing.yaml"""
    try:
        from hyperagent.core.config_loader import get_contract_price
        price = get_contract_price(contract_type)
        # Map contract types to tiers
        tier_map = {"ERC20": "basic", "ERC721": "basic", "Custom": "advanced"}
        tier = tier_map.get(contract_type, "advanced")
        return {"tier": tier, "price": price}
    except Exception:
        # Fallback to legacy hardcoded values during migration
        fallback = {
            "ERC20": {"tier": "basic", "price": 0.01},
            "ERC721": {"tier": "basic", "price": 0.02},
            "Custom": {"tier": "advanced", "price": 0.15},
        }
        return fallback.get(contract_type, fallback["Custom"])


@router.post("/generate", response_model=ContractGenerationResponse)
async def generate_contract_with_payment(
    request: ContractGenerationRequest, http_request: Request, db: AsyncSession = Depends(get_db)
):
    contract_type = request.contract_type or "Custom"
    tier_info = get_price_tier_info(contract_type)

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
