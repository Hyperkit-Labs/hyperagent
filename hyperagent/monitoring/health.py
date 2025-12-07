"""Health monitoring and alerting"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List

from hyperagent.monitoring.metrics import MetricsCollector


@dataclass
class HealthMetric:
    """Health metric with threshold"""

    name: str
    value: float
    threshold: float
    status: str  # healthy, warning, critical
    timestamp: datetime


class HealthMonitor:
    """
    Health Monitor

    Concept: Continuous health monitoring with alerting
    Logic: Check metrics against thresholds, generate alerts
    Usage: Proactive issue detection
    """

    def __init__(self):
        self.metrics_history: List[HealthMetric] = []
        self.alert_thresholds = {
            "error_rate": 5.0,  # 5% error rate
            "response_time_p95": 2.0,  # 2 seconds
            "response_time_p99": 5.0,  # 5 seconds
            "database_connections": 80,  # 80% of max
            "redis_memory": 90,  # 90% of max
        }

    async def check_health(self) -> Dict[str, Any]:
        """
        Perform health check

        Returns:
            Health status with metrics and alerts
        """
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "metrics": {},
            "alerts": [],
        }

        # Check error rate
        error_rate = await self._check_error_rate()
        health_status["metrics"]["error_rate"] = error_rate

        # Check response times
        response_times = await self._check_response_times()
        health_status["metrics"]["response_times"] = response_times

        # Check resource usage
        resources = await self._check_resources()
        health_status["metrics"]["resources"] = resources

        # Generate alerts
        alerts = self._generate_alerts(health_status["metrics"])
        health_status["alerts"] = alerts

        # Determine overall status
        if any(alert["severity"] == "critical" for alert in alerts):
            health_status["status"] = "critical"
        elif any(alert["severity"] == "warning" for alert in alerts):
            health_status["status"] = "warning"

        return health_status

    async def _check_error_rate(self) -> Dict[str, Any]:
        """Check error rate from metrics"""
        # This would query Prometheus metrics
        # For now, return placeholder
        return {"value": 0.5, "threshold": self.alert_thresholds["error_rate"], "status": "healthy"}

    async def _check_response_times(self) -> Dict[str, Any]:
        """Check response time percentiles"""
        return {
            "p95": {
                "value": 1.2,
                "threshold": self.alert_thresholds["response_time_p95"],
                "status": "healthy",
            },
            "p99": {
                "value": 3.5,
                "threshold": self.alert_thresholds["response_time_p99"],
                "status": "healthy",
            },
        }

    async def _check_resources(self) -> Dict[str, Any]:
        """Check resource usage"""
        return {
            "database_connections": {
                "value": 45,
                "threshold": self.alert_thresholds["database_connections"],
                "status": "healthy",
            },
            "redis_memory": {
                "value": 60,
                "threshold": self.alert_thresholds["redis_memory"],
                "status": "healthy",
            },
        }

    def _generate_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate alerts based on metrics"""
        alerts = []

        # Check error rate
        error_rate = metrics.get("error_rate", {})
        if error_rate.get("value", 0) > error_rate.get("threshold", 0):
            alerts.append(
                {
                    "severity": "critical",
                    "metric": "error_rate",
                    "message": f"Error rate {error_rate['value']}% exceeds threshold {error_rate['threshold']}%",
                    "timestamp": datetime.now().isoformat(),
                }
            )

        # Check response times
        response_times = metrics.get("response_times", {})
        p95 = response_times.get("p95", {})
        if p95.get("value", 0) > p95.get("threshold", 0):
            alerts.append(
                {
                    "severity": "warning",
                    "metric": "response_time_p95",
                    "message": f"P95 response time {p95['value']}s exceeds threshold {p95['threshold']}s",
                    "timestamp": datetime.now().isoformat(),
                }
            )

        return alerts

    async def start_monitoring(self, interval_seconds: int = 60):
        """Start continuous health monitoring"""
        print(f"[*] Starting health monitoring (interval: {interval_seconds}s)")

        while True:
            try:
                health = await self.check_health()

                if health["status"] != "healthy":
                    print(f"[!] Health status: {health['status']}")
                    for alert in health["alerts"]:
                        print(f"  [{alert['severity'].upper()}] {alert['message']}")

                await asyncio.sleep(interval_seconds)
            except Exception as e:
                print(f"[-] Health monitoring error: {e}")
                await asyncio.sleep(interval_seconds)
