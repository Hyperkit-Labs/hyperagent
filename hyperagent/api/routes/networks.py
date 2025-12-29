"""Network feature and compatibility API endpoints"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.blockchain.network_features import (
    NETWORK_FEATURES,
    NetworkFeature,
    NetworkFeatureManager,
)
from hyperagent.blockchain.network_registry import NetworkRegistry
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.db.session import get_db

router = APIRouter(prefix="/api/v1/networks", tags=["networks"])

# Initialize network registry (singleton)
_network_registry: Optional[NetworkRegistry] = None


def get_network_registry() -> NetworkRegistry:
    """Get or create NetworkRegistry instance"""
    global _network_registry
    if _network_registry is None:
        redis_manager = None
        if settings.redis_url:
            try:
                redis_manager = RedisManager(settings.redis_url)
            except Exception as e:
                logger.warning(f"Failed to initialize Redis for NetworkRegistry: {e}")
        _network_registry = NetworkRegistry(redis_manager=redis_manager)
    return _network_registry


import logging

logger = logging.getLogger(__name__)


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


class NetworkListResponse(BaseModel):
    """Paginated network list response"""
    networks: List[NetworkFeatureResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


@router.get("", response_model=NetworkListResponse)
async def list_networks(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=100, description="Number of networks per page"),
    search: Optional[str] = Query(None, description="Search by name, chain_id, or currency"),
    features: Optional[str] = Query(None, description="Comma-separated list of features to filter by"),
    x402_enabled: Optional[bool] = Query(None, description="Filter by x402 support"),
    testnet_only: Optional[bool] = Query(None, description="Filter testnets only"),
    mainnet_only: Optional[bool] = Query(None, description="Filter mainnets only"),
    currency: Optional[str] = Query(None, description="Filter by currency"),
) -> NetworkListResponse:
    """
    List all supported networks with pagination, search, and filtering
    
    Supports 1000+ networks efficiently with pagination.
    
    Args:
        page: Page number (default: 1)
        limit: Networks per page (default: 50, max: 100)
        search: Search query (searches name, chain_id, currency)
        features: Comma-separated feature filter (e.g., "pef,eigenda")
        x402_enabled: Filter by x402 payment support
        testnet_only: Show only testnets
        mainnet_only: Show only mainnets
        currency: Filter by currency symbol

    Returns:
        Paginated list of networks with metadata
    """
    registry = get_network_registry()
    
    # Build filters
    filters: Dict[str, Any] = {}
    if features:
        filters["features"] = [f.strip() for f in features.split(",") if f.strip()]
    if x402_enabled is not None:
        filters["x402_enabled"] = x402_enabled
    if testnet_only:
        filters["testnet_only"] = True
    if mainnet_only:
        filters["mainnet_only"] = True
    if currency:
        filters["currency"] = currency
    
    # Get paginated networks
    if search:
        # Use search instead of pagination
        all_networks = await registry.search_networks(search)
        # Apply filters to search results
        filtered_networks = registry._apply_filters(all_networks, filters)
        # Manual pagination for search results
        total = len(filtered_networks)
        start = (page - 1) * limit
        end = start + limit
        paginated_networks = filtered_networks[start:end]
        result = {
            "networks": paginated_networks,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": end < total,
            "has_prev": page > 1,
        }
    else:
        result = await registry.list_networks(page=page, limit=limit, filters=filters)

    # Convert to NetworkFeatureResponse format
    network_responses = []
    for net in result["networks"]:
        # Build fallback strategies
        fallbacks = {}
        features_dict = net.get("features", {})
        for feature in NetworkFeature:
            feature_key = feature.value
            if not features_dict.get(feature_key, False):
                fallback = NetworkFeatureManager.get_fallback_strategy(net["network"], feature)
                if fallback:
                    fallbacks[feature_key] = fallback

        network_responses.append(
            NetworkFeatureResponse(
                network=net["network"],
                features=features_dict,
                fallbacks=fallbacks,
                chain_id=net.get("chain_id"),
                rpc_url=net.get("rpc_url"),
                explorer=net.get("explorer"),
                currency=net.get("currency"),
                status="supported",
                is_supported=True,
                coming_soon=False,
                supports_x402=net.get("supports_x402", False),
            )
        )

    return NetworkListResponse(
        networks=network_responses,
        total=result["total"],
        page=result["page"],
        limit=result["limit"],
        has_next=result["has_next"],
        has_prev=result["has_prev"],
    )


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

    Uses NetworkRegistry with fallback chain for dynamic network loading.

    Args:
        network: Network name (e.g., "hyperion_testnet")

    Returns:
        Network features and fallback strategies
    """
    registry = get_network_registry()
    
    try:
        config = await registry.get_network(network)
    except Exception as e:
        logger.warning(f"Failed to load network {network} from registry: {e}")
        # Fallback to NetworkFeatureManager
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

    # Check x402 support
    supports_x402 = NetworkFeatureManager.is_x402_network(
        network, settings.x402_enabled, settings.x402_enabled_networks
    )

    return NetworkFeatureResponse(
        network=network,
        features=features_dict,
        fallbacks=fallbacks,
        chain_id=config.get("chain_id"),
        rpc_url=config.get("rpc_url"),
        explorer=config.get("explorer"),
        currency=config.get("currency"),
        status="supported",
        supports_x402=supports_x402,
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
