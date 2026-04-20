"""
Circuit breaker for external HTTP calls. In-process state, or Redis-backed when
REDIS_URL / UPSTASH_REDIS_URL is set and CIRCUIT_BREAKER_DISTRIBUTED is not disabled.
"""

from __future__ import annotations

import logging
import os
import time
from collections.abc import Awaitable
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

DEFAULT_FAILURE_THRESHOLD = 5
DEFAULT_RECOVERY_TIMEOUT_SEC = 60
FAILURE_WINDOW_SEC = 120


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
        except Exception:
            self.record_failure()
            raise


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and call is rejected."""


def _redis_url_for_cb() -> str:
    for key in ("REDIS_URL", "UPSTASH_REDIS_URL"):
        v = (os.environ.get(key) or "").strip()
        if v:
            return v
    return ""


def _redis_sync_client() -> Any | None:
    url = _redis_url_for_cb()
    if not url:
        return None
    try:
        import redis

        return redis.from_url(url, decode_responses=True)
    except Exception as e:
        logger.warning("[circuit_breaker] Redis unavailable: %s", e)
        return None


def _use_distributed() -> bool:
    return os.environ.get("CIRCUIT_BREAKER_DISTRIBUTED", "1").strip().lower() in (
        "1",
        "true",
        "yes",
    )


class DistributedCircuitBreaker:
    """Redis-tracked failures across workers; falls back to wrapped in-memory breaker."""

    def __init__(self, name: str, local: CircuitBreaker):
        self.name = name
        self._local = local
        self.failure_threshold = local.failure_threshold
        self.recovery_timeout_sec = local.recovery_timeout_sec

    def _r(self) -> Any | None:
        return _redis_sync_client() if _use_distributed() else None

    def record_success(self) -> None:
        r = self._r()
        if r:
            try:
                r.delete(f"ha:cb:{self.name}:open")
                r.delete(f"ha:cb:{self.name}:fails")
            except Exception as e:
                logger.warning("[circuit_breaker] redis clear failed: %s", e)
        self._local.record_success()

    def record_failure(self) -> None:
        r = self._r()
        if not r:
            self._local.record_failure()
            return
        now = time.time()
        k = f"ha:cb:{self.name}:fails"
        try:
            m = f"{now:.6f}"
            r.zadd(k, {m: now})
            r.zremrangebyscore(k, 0, now - FAILURE_WINDOW_SEC)
            r.expire(k, FAILURE_WINDOW_SEC + 30)
            if r.zcard(k) >= self.failure_threshold:
                r.set(
                    f"ha:cb:{self.name}:open",
                    "1",
                    ex=int(self.recovery_timeout_sec),
                )
                logger.warning(
                    "[circuit_breaker] %s open (distributed) after %d failures in window",
                    self.name,
                    self.failure_threshold,
                )
        except Exception as e:
            logger.warning("[circuit_breaker] redis failure record failed: %s", e)
            self._local.record_failure()

    def can_execute(self) -> bool:
        r = self._r()
        if not r:
            return self._local.can_execute()
        try:
            if r.get(f"ha:cb:{self.name}:open"):
                return False
        except Exception as e:
            logger.warning("[circuit_breaker] redis can_execute failed: %s", e)
            return self._local.can_execute()
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
        except Exception:
            self.record_failure()
            raise


_local_breakers: dict[str, CircuitBreaker] = {}
_dist_breakers: dict[str, DistributedCircuitBreaker] = {}


def get_breaker(name: str) -> CircuitBreaker | DistributedCircuitBreaker:
    if name not in _local_breakers:
        _local_breakers[name] = CircuitBreaker(name)
    local = _local_breakers[name]
    if _redis_url_for_cb() and _use_distributed():
        if name not in _dist_breakers:
            _dist_breakers[name] = DistributedCircuitBreaker(name, local)
        return _dist_breakers[name]
    return local
