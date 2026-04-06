"""
Simple circuit breaker for external HTTP calls. Prevents cascading failures when
Tenderly, Pinata, audit, or other services are down.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_FAILURE_THRESHOLD = 5
DEFAULT_RECOVERY_TIMEOUT_SEC = 60


class CircuitBreaker:
    """In-memory circuit breaker. Open after threshold failures; half-open after timeout."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        recovery_timeout_sec: float = DEFAULT_RECOVERY_TIMEOUT_SEC,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self.failures = 0
        self.last_failure_time: float | None = None
        self.state = "closed"

    def _now(self) -> float:
        return time.monotonic()

    def record_success(self) -> None:
        if self.state == "half_open":
            self.state = "closed"
            self.failures = 0
            self.last_failure_time = None
            logger.info("[circuit_breaker] %s closed after successful call", self.name)

    def record_failure(self) -> None:
        self.failures += 1
        self.last_failure_time = self._now()
        if self.state == "closed" and self.failures >= self.failure_threshold:
            self.state = "open"
            logger.warning(
                "[circuit_breaker] %s open after %d failures",
                self.name,
                self.failures,
            )

    def can_execute(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if self.last_failure_time is None:
                return True
            elapsed = self._now() - self.last_failure_time
            if elapsed >= self.recovery_timeout_sec:
                self.state = "half_open"
                logger.info("[circuit_breaker] %s half_open, allowing trial", self.name)
                return True
            return False
        return True

    async def call(
        self, fn: Callable[..., Awaitable[T]], *args: object, **kwargs: object
    ) -> T:
        if not self.can_execute():
            raise CircuitOpenError(f"Circuit {self.name} is open")
        try:
            result = await fn(*args, **kwargs)
            self.record_success()
            return result
        except Exception as e:
            self.record_failure()
            raise


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and call is rejected."""


_breakers: dict[str, CircuitBreaker] = {}


def get_breaker(name: str) -> CircuitBreaker:
    if name not in _breakers:
        _breakers[name] = CircuitBreaker(name)
    return _breakers[name]
