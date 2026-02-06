"""Anomaly Detection - Layer 7 of 7-Layer Security Defense"""

import logging
from collections import deque
from typing import Any, Dict, List, Optional

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)

GAS_SPIKE_THRESHOLD_MULTIPLIER = 3.0
MAX_FAILURE_RATE_PERCENT = 20
CONSECUTIVE_ERRORS_THRESHOLD = 5
ALERT_SEVERITY_HIGH = "HIGH"


class AnomalyDetector:
    """Detects anomalies in gas usage, token flows, and build failures"""

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize Anomaly Detector

        Args:
            redis_manager: Optional Redis manager for metrics storage
        """
        self.redis_manager = redis_manager
        self._gas_history: Dict[str, deque] = {}
        self._failure_history: deque = deque(maxlen=100)
        self._alert_callbacks: List[callable] = []

    async def detect_anomalies(
        self, build_id: str, metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Detect anomalies in build metrics

        Args:
            build_id: Build identifier
            metrics: Dictionary with gas_used, token_flows, status, etc.

        Returns:
            Dictionary with anomaly flags and alerts
        """
        anomalies = {
            "gas_spike": False,
            "token_flow_anomaly": False,
            "high_failure_rate": False,
            "high_severity_finding": False,
            "alerts": [],
        }

        gas_used = metrics.get("gas_used")
        if gas_used:
            gas_anomaly = await self._check_gas_spike(build_id, gas_used)
            if gas_anomaly:
                anomalies["gas_spike"] = True
                anomalies["alerts"].append(
                    {
                        "type": "gas_spike",
                        "severity": "medium",
                        "message": f"Gas usage spike detected: {gas_used}",
                    }
                )

        token_flows = metrics.get("token_flows", [])
        if token_flows:
            flow_anomaly = await self._check_token_flows(token_flows)
            if flow_anomaly:
                anomalies["token_flow_anomaly"] = True
                anomalies["alerts"].append(
                    {
                        "type": "token_flow",
                        "severity": "high",
                        "message": "Unusual token flow pattern detected",
                    }
                )

        build_status = metrics.get("status")
        if build_status == "failed":
            self._failure_history.append(1)
        else:
            self._failure_history.append(0)

        failure_rate = await self._check_failure_rate()
        if failure_rate > MAX_FAILURE_RATE_PERCENT:
            anomalies["high_failure_rate"] = True
            anomalies["alerts"].append(
                {
                    "type": "failure_rate",
                    "severity": "critical",
                    "message": f"Build failure rate exceeds threshold: {failure_rate}%",
                }
            )

        audit_findings = metrics.get("audit_findings", [])
        high_severity = [
            f for f in audit_findings if f.get("severity", "").upper() == ALERT_SEVERITY_HIGH
        ]
        if high_severity:
            anomalies["high_severity_finding"] = True
            anomalies["alerts"].append(
                {
                    "type": "audit_finding",
                    "severity": "high",
                    "message": f"{len(high_severity)} HIGH severity findings detected",
                    "findings": high_severity,
                }
            )

        if anomalies["alerts"]:
            await self._send_alerts(anomalies["alerts"])

        return anomalies

    async def _check_gas_spike(self, build_id: str, gas_used: int) -> bool:
        """Check if gas usage is anomalously high"""
        if build_id not in self._gas_history:
            self._gas_history[build_id] = deque(maxlen=10)

        history = self._gas_history[build_id]
        history.append(gas_used)

        if len(history) < 3:
            return False

        avg_gas = sum(history) / len(history)
        threshold = avg_gas * GAS_SPIKE_THRESHOLD_MULTIPLIER

        if gas_used > threshold:
            logger.warning(
                f"Gas spike detected for {build_id}: {gas_used} > {threshold} (avg: {avg_gas})"
            )
            return True

        return False

    async def _check_token_flows(self, token_flows: List[Dict]) -> bool:
        """Check for unusual token flow patterns"""
        if not token_flows:
            return False

        total_flows = sum(flow.get("amount", 0) for flow in token_flows)
        if total_flows == 0:
            return False

        large_flows = [f for f in token_flows if f.get("amount", 0) > total_flows * 0.5]
        if len(large_flows) > 2:
            logger.warning(f"Unusual token flow pattern: {len(large_flows)} large flows detected")
            return True

        return False

    async def _check_failure_rate(self) -> float:
        """Calculate current build failure rate"""
        if len(self._failure_history) < 10:
            return 0.0

        failures = sum(self._failure_history)
        total = len(self._failure_history)
        rate = (failures / total) * 100

        if rate > MAX_FAILURE_RATE_PERCENT:
            logger.warning(f"High failure rate detected: {rate:.2f}%")

        return rate

    async def _send_alerts(self, alerts: List[Dict]):
        """Send alerts to monitoring system"""
        for alert in alerts:
            logger.warning(
                f"ANOMALY ALERT [{alert['severity'].upper()}]: {alert['message']}"
            )

            if self.redis_manager:
                try:
                    await self.redis_manager.set(
                        f"alert:{alert['type']}",
                        alert,
                        ttl=3600,
                    )
                except Exception as e:
                    logger.error(f"Failed to store alert: {e}")

        for callback in self._alert_callbacks:
            try:
                await callback(alerts)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")

    def register_alert_callback(self, callback: callable):
        """Register callback for alerts"""
        self._alert_callbacks.append(callback)

    async def get_metrics_summary(self) -> Dict[str, Any]:
        """Get summary of anomaly metrics"""
        return {
            "gas_history_size": sum(len(h) for h in self._gas_history.values()),
            "failure_rate": await self._check_failure_rate(),
            "recent_failures": sum(self._failure_history),
            "total_builds": len(self._failure_history),
        }

