"""Dune Analytics integration for TVL tracking and revenue analysis"""

import logging
from typing import Any, Dict, Optional

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class DuneIntegration:
    """Integrates with Dune Analytics for on-chain metrics"""

    def __init__(self):
        """Initialize Dune Integration"""
        self._dune_client = None
        self._query_id = None

    def _get_dune_client(self):
        """Lazy initialization of Dune client"""
        if self._dune_client is None:
            try:
                api_key = getattr(settings, "dune_api_key", None)
                if not api_key:
                    logger.warning("Dune API key not configured")
                    return None

                from dune_client.client import DuneClient

                self._dune_client = DuneClient(api_key)
                self._query_id = getattr(settings, "dune_mantle_query_id", None) or 6388392
            except ImportError:
                logger.warning(
                    "dune-client package not installed. Install with: pip install dune-client"
                )
                return None
            except Exception as e:
                logger.warning(f"Failed to initialize Dune client: {e}")
                return None

        return self._dune_client

    async def get_tvl(self, contract_address: str, network: str = "mantle") -> float:
        """
        Get TVL for a contract address

        Args:
            contract_address: Contract address
            network: Blockchain network

        Returns:
            TVL value in USD
        """
        client = self._get_dune_client()
        if not client:
            return 0.0

        try:
            import asyncio

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: client.get_latest_result(self._query_id)
            )
            if result and result.result and result.result.rows:
                tvl = result.result.rows[0].get("tvl_usd")
                return float(tvl) if tvl is not None else 0.0
        except Exception as e:
            logger.error(f"Failed to get TVL from Dune: {e}")
            return 0.0

        return 0.0

    async def get_gas_savings(self, network: str, start_date: Optional[str] = None) -> float:
        """
        Calculate total gas savings across deployments

        Args:
            network: Blockchain network
            start_date: Optional start date (YYYY-MM-DD)

        Returns:
            Total gas saved in USD
        """
        client = self._get_dune_client()
        if not client:
            return 0.0

        try:
            import asyncio

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: client.get_latest_result(self._query_id)
            )
            if result and result.result and result.result.rows:
                savings = result.result.rows[0].get("total_gas_saved_usd")
                return float(savings) if savings is not None else 0.0
        except Exception as e:
            logger.error(f"Failed to get gas savings from Dune: {e}")
            return 0.0

        return 0.0

    async def get_revenue_breakdown(
        self, network: str, start_date: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Get revenue breakdown (creator, auditor, protocol)

        Args:
            network: Blockchain network
            start_date: Optional start date

        Returns:
            Dictionary with revenue breakdown
        """
        client = self._get_dune_client()
        if not client:
            return {"creator": 0.0, "auditor": 0.0, "protocol": 0.0}

        try:
            import asyncio

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: client.get_latest_result(self._query_id)
            )
            if result and result.result and result.result.rows:
                row = result.result.rows[0]
                return {
                    "creator": float(row.get("creator_revenue", 0) or 0),
                    "auditor": float(row.get("auditor_revenue", 0) or 0),
                    "protocol": float(row.get("protocol_revenue", 0) or 0),
                }
        except Exception as e:
            logger.error(f"Failed to get revenue breakdown from Dune: {e}")
            return {"creator": 0.0, "auditor": 0.0, "protocol": 0.0}

        return {"creator": 0.0, "auditor": 0.0, "protocol": 0.0}

    async def get_all_metrics(self) -> Dict[str, Any]:
        """
        Get all metrics from Dune in one call

        Returns:
            Dictionary with all metrics
        """
        client = self._get_dune_client()
        if not client:
            return {
                "tvl_usd": 0.0,
                "total_gas_saved_usd": 0.0,
                "creator_revenue": 0.0,
                "auditor_revenue": 0.0,
                "protocol_revenue": 0.0,
            }

        try:
            import asyncio

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, lambda: client.get_latest_result(self._query_id)
            )
            if result and result.result and result.result.rows:
                row = result.result.rows[0]
                return {
                    "tvl_usd": float(row.get("tvl_usd", 0) or 0),
                    "total_gas_saved_usd": float(row.get("total_gas_saved_usd", 0) or 0),
                    "creator_revenue": float(row.get("creator_revenue", 0) or 0),
                    "auditor_revenue": float(row.get("auditor_revenue", 0) or 0),
                    "protocol_revenue": float(row.get("protocol_revenue", 0) or 0),
                }
        except Exception as e:
            logger.error(f"Failed to get metrics from Dune: {e}")
            return {
                "tvl_usd": 0.0,
                "total_gas_saved_usd": 0.0,
                "creator_revenue": 0.0,
                "auditor_revenue": 0.0,
                "protocol_revenue": 0.0,
            }

        return {
            "tvl_usd": 0.0,
            "total_gas_saved_usd": 0.0,
            "creator_revenue": 0.0,
            "auditor_revenue": 0.0,
            "protocol_revenue": 0.0,
        }
