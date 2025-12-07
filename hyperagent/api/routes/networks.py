"""Network feature and compatibility API endpoints"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.blockchain.network_features import (
    NETWORK_FEATURES,
    NetworkFeature,
    NetworkFeatureManager,
)
from hyperagent.db.session import get_db

router = APIRouter(prefix="/api/v1/networks", tags=["networks"])


class NetworkFeatureResponse(BaseModel):
    """Network feature response model"""

    network: str
    features: Dict[str, bool]
    fallbacks: Dict[str, str]
    chain_id: Optional[int] = None
    rpc_url: Optional[str] = None
    explorer: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = "supported"  # "supported" | "coming_soon"
    is_supported: bool = True  # True if network is fully supported
    coming_soon: bool = False  # True if network is coming soon
    supports_x402: bool = False  # True if network supports x402 payments


class NetworkCompatibilityResponse(BaseModel):
    """Network compatibility report"""

    network: str
    supports_pef: bool
    supports_metisvm: bool
    supports_eigenda: bool
    supports_batch_deployment: bool
    supports_floating_point: bool
    supports_ai_inference: bool
    fallback_strategies: Dict[str, str]
    recommendations: List[str]


@router.get("", response_model=List[NetworkFeatureResponse])
async def list_networks() -> List[NetworkFeatureResponse]:
    """
    List all supported networks with their features
    Also includes "coming soon" networks from x402_enabled_networks

    Returns:
        List of networks with feature flags and fallback strategies
    """
    from hyperagent.core.config import settings

    networks = []
    supported_networks = set(NetworkFeatureManager.list_networks())

    # Get x402-enabled networks (may include coming soon)
    x402_networks = set()
    if settings.x402_enabled_networks:
        x402_networks = {n.strip() for n in settings.x402_enabled_networks.split(",") if n.strip()}

    # Add supported networks
    for network_name in supported_networks:
        config = NetworkFeatureManager.get_network_config(network_name)
        features = NetworkFeatureManager.get_features(network_name)

        # Convert NetworkFeature enum keys to strings
        features_dict = {feature.value: supported for feature, supported in features.items()}

        # Build fallback strategies
        fallbacks = {}
        for feature in NetworkFeature:
            if not features.get(feature, False):
                fallback = NetworkFeatureManager.get_fallback_strategy(network_name, feature)
                if fallback:
                    fallbacks[feature.value] = fallback

        # Check if network supports x402
        supports_x402 = network_name in x402_networks and settings.x402_enabled

        networks.append(
            NetworkFeatureResponse(
                network=network_name,
                features=features_dict,
                fallbacks=fallbacks,
                chain_id=config.get("chain_id"),
                rpc_url=config.get("rpc_url"),
                explorer=config.get("explorer"),
                currency=config.get("currency"),
                status="supported",
                is_supported=True,
                coming_soon=False,
                supports_x402=supports_x402,
            )
        )

    # No "coming soon" networks - only supported networks are shown
    # Supported networks: Hyperion, Metis, Mantle, Avalanche
    # x402 payments are only available on Avalanche networks

    return networks


@router.get("/x402", response_model=List[NetworkFeatureResponse])
async def list_x402_networks():
    """
    List only networks that support x402 payments

    Returns:
        List of x402-enabled networks
    """
    from hyperagent.core.config import settings

    all_networks = await list_networks()

    # Filter to only x402-enabled networks
    x402_networks = [network for network in all_networks if network.supports_x402]

    return x402_networks


@router.get("/{network}/features", response_model=NetworkFeatureResponse)
async def get_network_features(network: str) -> NetworkFeatureResponse:
    """
    Get features for a specific network

    Args:
        network: Network name (e.g., "hyperion_testnet")

    Returns:
        Network features and fallback strategies
    """
    if network not in NETWORK_FEATURES:
        raise HTTPException(
            status_code=404,
            detail=f"Network '{network}' not found. Use /api/v1/networks to list available networks.",
        )

    config = NetworkFeatureManager.get_network_config(network)
    features = NetworkFeatureManager.get_features(network)

    # Convert NetworkFeature enum keys to strings
    features_dict = {feature.value: supported for feature, supported in features.items()}

    # Build fallback strategies
    fallbacks = {}
    for feature in NetworkFeature:
        if not features.get(feature, False):
            fallback = NetworkFeatureManager.get_fallback_strategy(network, feature)
            if fallback:
                fallbacks[feature.value] = fallback

    return NetworkFeatureResponse(
        network=network,
        features=features_dict,
        fallbacks=fallbacks,
        chain_id=config.get("chain_id"),
        rpc_url=config.get("rpc_url"),
        explorer=config.get("explorer"),
        currency=config.get("currency"),
        status="supported",
    )


@router.get("/{network}/compatibility", response_model=NetworkCompatibilityResponse)
async def get_network_compatibility(network: str) -> NetworkCompatibilityResponse:
    """
    Get compatibility report for a network

    Args:
        network: Network name

    Returns:
        Detailed compatibility report with recommendations
    """
    if network not in NETWORK_FEATURES:
        raise HTTPException(status_code=404, detail=f"Network '{network}' not found")

    features = NetworkFeatureManager.get_features(network)

    # Build fallback strategies
    fallback_strategies = {}
    for feature in NetworkFeature:
        if not features.get(feature, False):
            fallback = NetworkFeatureManager.get_fallback_strategy(network, feature)
            if fallback:
                fallback_strategies[feature.value] = fallback

    # Generate recommendations
    recommendations = []
    if not features.get(NetworkFeature.PEF, False):
        recommendations.append("Use sequential deployment instead of PEF for batch operations")
    if not features.get(NetworkFeature.METISVM, False):
        recommendations.append(
            "MetisVM optimizations not available - contracts will use standard compilation"
        )
    if not features.get(NetworkFeature.EIGENDA, False):
        if network.endswith("_testnet"):
            recommendations.append("EigenDA disabled on testnet for cost optimization")
        else:
            recommendations.append(
                "EigenDA not available - contract metadata will not be stored on data availability layer"
            )
    if not features.get(NetworkFeature.FLOATING_POINT, False):
        recommendations.append(
            "Floating-point operations not supported - use fixed-point math libraries"
        )
    if not features.get(NetworkFeature.AI_INFERENCE, False):
        recommendations.append("On-chain AI inference not available")

    return NetworkCompatibilityResponse(
        network=network,
        supports_pef=features.get(NetworkFeature.PEF, False),
        supports_metisvm=features.get(NetworkFeature.METISVM, False),
        supports_eigenda=features.get(NetworkFeature.EIGENDA, False),
        supports_batch_deployment=features.get(NetworkFeature.BATCH_DEPLOYMENT, False),
        supports_floating_point=features.get(NetworkFeature.FLOATING_POINT, False),
        supports_ai_inference=features.get(NetworkFeature.AI_INFERENCE, False),
        fallback_strategies=fallback_strategies,
        recommendations=recommendations,
    )
