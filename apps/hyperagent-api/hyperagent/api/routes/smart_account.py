"""API endpoint to check if address is Smart Account"""

from fastapi import APIRouter, Query
from hyperagent.blockchain.erc4337 import ERC4337AccountAbstraction
from hyperagent.blockchain.networks import NetworkManager

router = APIRouter(prefix="/api/v1/x402/deployments", tags=["x402-deployments"])

_network_manager = NetworkManager()
_erc4337 = ERC4337AccountAbstraction(_network_manager)


@router.get("/check-smart-account")
async def check_smart_account(
    address: str = Query(..., description="Wallet address to check"),
    network: str = Query(..., description="Target network")
):
    """
    Check if an address is an ERC-4337 Smart Account
    
    Returns:
        {
            "is_smart_account": bool,
            "address": str,
            "network": str
        }
    """
    is_smart = await _erc4337.is_smart_account(address, network)
    
    return {
        "is_smart_account": is_smart,
        "address": address,
        "network": network
    }

