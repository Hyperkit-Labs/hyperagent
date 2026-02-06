"""7-Layer Defense System - Unified security orchestration"""

import logging
from typing import Any, Dict, Optional, Tuple

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.security.anomaly_detector import AnomalyDetector
from hyperagent.security.input_validator import InputValidator
from hyperagent.security.memory_isolation import MemoryIsolation

logger = logging.getLogger(__name__)

CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3
EMERGENCY_PAUSE_KEY = "defense:emergency_pause"


class DefenseSystem:
    """Orchestrates all 7 security layers"""

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize Defense System

        Args:
            redis_manager: Optional Redis manager
        """
        self.redis_manager = redis_manager
        self.input_validator = InputValidator(redis_manager=redis_manager)
        self.memory_isolation = MemoryIsolation(redis_manager=redis_manager)
        self.anomaly_detector = AnomalyDetector(redis_manager=redis_manager)
        self._circuit_breaker_failures = 0
        self._emergency_paused = False

    async def validate_request(
        self, request: Dict[str, Any], user_id: str, ip_address: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Validate request through all 7 security layers

        Args:
            request: Request dictionary with prompt, contract_code, etc.
            user_id: User identifier
            ip_address: Optional IP address

        Returns:
            Tuple of (is_valid, error_message)
        """
        if await self._is_emergency_paused():
            return False, "System is in emergency pause mode"

        prompt = request.get("prompt", "") or request.get("nlp_input", "")

        is_valid, error = await self.input_validator.validate(prompt, user_id, ip_address)
        if not is_valid:
            await self._record_failure()
            return False, f"Layer 1 (Input Validation) failed: {error}"

        if await self._check_circuit_breaker():
            return False, "Circuit breaker activated due to consecutive failures"

        await self._reset_circuit_breaker()
        return True, ""

    async def _is_emergency_paused(self) -> bool:
        """Check if system is in emergency pause"""
        if self._emergency_paused:
            return True

        if self.redis_manager:
            paused = await self.redis_manager.get(EMERGENCY_PAUSE_KEY)
            if paused:
                self._emergency_paused = True
                return True

        return False

    async def emergency_pause(self, reason: str):
        """Activate emergency pause"""
        self._emergency_paused = True
        if self.redis_manager:
            await self.redis_manager.set(
                EMERGENCY_PAUSE_KEY, {"reason": reason, "paused": True}, ttl=3600
            )
        logger.critical(f"EMERGENCY PAUSE ACTIVATED: {reason}")

    async def emergency_resume(self):
        """Resume from emergency pause"""
        self._emergency_paused = False
        if self.redis_manager:
            await self.redis_manager.client.delete(EMERGENCY_PAUSE_KEY)
        logger.info("Emergency pause resumed")

    async def _check_circuit_breaker(self) -> bool:
        """Check if circuit breaker should activate"""
        return self._circuit_breaker_failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD

    async def _record_failure(self):
        """Record failure for circuit breaker"""
        self._circuit_breaker_failures += 1
        if self._circuit_breaker_failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD:
            logger.warning(
                f"Circuit breaker activated after {self._circuit_breaker_failures} consecutive failures"
            )

    async def _reset_circuit_breaker(self):
        """Reset circuit breaker on success"""
        if self._circuit_breaker_failures > 0:
            self._circuit_breaker_failures = 0
            logger.info("Circuit breaker reset")

    async def monitor_build(
        self, build_id: str, metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Monitor build for anomalies (Layer 7)

        Args:
            build_id: Build identifier
            metrics: Build metrics

        Returns:
            Anomaly detection results
        """
        anomalies = await self.anomaly_detector.detect_anomalies(build_id, metrics)

        if anomalies.get("high_failure_rate"):
            await self.emergency_pause("High build failure rate detected")

        return anomalies

    async def validate_high_value_operation(
        self, operation: str, value: float, multi_sig_required: bool = True
    ) -> Tuple[bool, str]:
        """
        Validate high-value operations with multi-sig gates

        Args:
            operation: Operation type
            value: Operation value
            multi_sig_required: If True, require multi-sig approval

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not multi_sig_required:
            return True, ""

        high_value_threshold = 10000.0
        if value < high_value_threshold:
            return True, ""

        multi_sig_approved = await self._check_multi_sig(operation, value)
        if not multi_sig_approved:
            return False, "Multi-sig approval required for high-value operations"

        return True, ""

    async def _check_multi_sig(self, operation: str, value: float) -> bool:
        """Check if multi-sig approval exists"""
        if self.redis_manager:
            key = f"multisig:{operation}:{value}"
            approval = await self.redis_manager.get(key)
            return approval is not None
        return False

