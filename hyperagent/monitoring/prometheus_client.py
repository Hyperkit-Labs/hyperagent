"""
Prometheus API client for querying metrics
"""

import logging
from typing import Any, Dict, Optional
import httpx
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class PrometheusClient:
    """
    Client for querying Prometheus metrics API
    
    Connects to Prometheus API endpoint and executes PromQL queries
    """

    def __init__(self, base_url: Optional[str] = None, timeout: float = 5.0):
        """
        Initialize Prometheus client
        
        Args:
            base_url: Prometheus API base URL (defaults to PROMETHEUS_URL from settings)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or getattr(settings, "prometheus_url", "http://localhost:9090")
        self.timeout = timeout
        self.api_path = "/api/v1/query"

    async def query(self, promql: str) -> Dict[str, Any]:
        """
        Execute a PromQL query
        
        Args:
            promql: Prometheus Query Language query string
            
        Returns:
            Query result dictionary with 'status', 'data', etc.
            
        Raises:
            httpx.HTTPError: If request fails
            ValueError: If query result indicates error
        """
        try:
            url = f"{self.base_url}{self.api_path}"
            params = {"query": promql}

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                result = response.json()

            if result.get("status") == "error":
                error_type = result.get("errorType", "unknown")
                error_msg = result.get("error", "Unknown error")
                raise ValueError(f"Prometheus query error ({error_type}): {error_msg}")

            return result
        except httpx.TimeoutException:
            logger.warning(f"Prometheus query timed out: {promql}")
            raise
        except httpx.HTTPError as e:
            logger.error(f"Prometheus HTTP error: {e}")
            raise
        except Exception as e:
            logger.error(f"Prometheus query failed: {e}", exc_info=True)
            raise

    async def query_instant(self, promql: str) -> Optional[float]:
        """
        Execute a PromQL query and return a single numeric value
        
        Useful for queries that return a single scalar or vector with one element
        
        Args:
            promql: Prometheus Query Language query string
            
        Returns:
            Numeric value if found, None otherwise
        """
        try:
            result = await self.query(promql)
            data = result.get("data", {})
            result_type = data.get("resultType")

            if result_type == "scalar":
                # Scalar result: [timestamp, value]
                value = data.get("result")
                if isinstance(value, list) and len(value) == 2:
                    return float(value[1])

            elif result_type == "vector":
                # Vector result: array of {metric: {}, value: [timestamp, value]}
                results = data.get("result", [])
                if results and len(results) > 0:
                    first_result = results[0]
                    value = first_result.get("value")
                    if isinstance(value, list) and len(value) == 2:
                        return float(value[1])

            return None
        except Exception as e:
            logger.warning(f"Failed to extract value from Prometheus query: {e}")
            return None

    async def get_error_rate(self, window: str = "5m") -> Optional[float]:
        """
        Calculate error rate as percentage
        
        Query: rate(hyperagent_agent_errors_total[5m]) / rate(hyperagent_agent_executions_total[5m]) * 100
        
        Args:
            window: Time window for rate calculation (e.g., "5m", "1h")
            
        Returns:
            Error rate as percentage (0-100), or None if metrics unavailable
        """
        try:
            # Query for error rate
            # This assumes metrics are named hyperagent_agent_errors_total and hyperagent_agent_executions_total
            promql = (
                f'(rate(hyperagent_agent_errors_total[{window}]) '
                f'/ rate(hyperagent_agent_executions_total[{window}])) * 100'
            )

            error_rate = await self.query_instant(promql)
            return error_rate
        except Exception as e:
            logger.warning(f"Failed to get error rate from Prometheus: {e}")
            return None

    async def get_metric_value(self, metric_name: str, labels: Optional[Dict[str, str]] = None) -> Optional[float]:
        """
        Get current value of a metric
        
        Args:
            metric_name: Name of the metric (e.g., "hyperagent_agent_executions_total")
            labels: Optional label filters (e.g., {"agent_name": "generate"})
            
        Returns:
            Metric value or None if not found
        """
        try:
            # Build PromQL query with labels
            promql = metric_name
            if labels:
                label_filters = ",".join([f'{k}="{v}"' for k, v in labels.items()])
                promql = f'{metric_name}{{{label_filters}}}'

            return await self.query_instant(promql)
        except Exception as e:
            logger.warning(f"Failed to get metric value for {metric_name}: {e}")
            return None

    async def is_available(self) -> bool:
        """
        Check if Prometheus API is available
        
        Returns:
            True if Prometheus is reachable, False otherwise
        """
        try:
            # Simple health check query
            await self.query("up")
            return True
        except Exception:
            return False


def create_prometheus_client() -> PrometheusClient:
    """
    Create Prometheus client with default configuration
    
    Returns:
        PrometheusClient instance
    """
    prometheus_url = getattr(settings, "prometheus_url", "http://localhost:9090")
    return PrometheusClient(base_url=prometheus_url)

