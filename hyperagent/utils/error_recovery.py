"""Error recovery and circuit breaker utilities"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration"""
    failure_threshold: int = 5  # Open circuit after N failures
    success_threshold: int = 2  # Close circuit after N successes in half-open
    timeout_seconds: int = 60  # Time before trying half-open
    expected_exception: type = Exception  # Exception type to catch


@dataclass
class CircuitBreakerStats:
    """Circuit breaker statistics"""
    failures: int = 0
    successes: int = 0
    last_failure_time: Optional[datetime] = None
    state: CircuitState = CircuitState.CLOSED
    opened_at: Optional[datetime] = None


class CircuitBreaker:
    """
    Circuit breaker pattern for error recovery

    Concept: Prevent cascading failures by stopping requests to failing services
    Logic:
        1. Track failures and successes
        2. Open circuit after threshold failures
        3. Try half-open after timeout
        4. Close circuit after threshold successes
    """

    def __init__(self, name: str, config: Optional[CircuitBreakerConfig] = None):
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.stats = CircuitBreakerStats()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection

        Args:
            func: Async function to execute
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            Function result

        Raises:
            CircuitBreakerOpenError: If circuit is open
            Original exception: If function fails
        """
        # Check circuit state
        if self.stats.state == CircuitState.OPEN:
            # Check if timeout has passed
            if self.stats.opened_at:
                elapsed = (datetime.now() - self.stats.opened_at).total_seconds()
                if elapsed >= self.config.timeout_seconds:
                    logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                    self.stats.state = CircuitState.HALF_OPEN
                    self.stats.successes = 0
                else:
                    raise CircuitBreakerOpenError(
                        f"Circuit breaker {self.name} is OPEN. "
                        f"Retry after {self.config.timeout_seconds - int(elapsed)}s"
                    )

        # Execute function
        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except self.config.expected_exception as e:
            self._on_failure()
            raise

    def _on_success(self):
        """Handle successful call"""
        if self.stats.state == CircuitState.HALF_OPEN:
            self.stats.successes += 1
            if self.stats.successes >= self.config.success_threshold:
                logger.info(f"Circuit breaker {self.name} closing (recovered)")
                self.stats.state = CircuitState.CLOSED
                self.stats.failures = 0
                self.stats.opened_at = None
        elif self.stats.state == CircuitState.CLOSED:
            self.stats.failures = 0  # Reset failure count on success

    def _on_failure(self):
        """Handle failed call"""
        self.stats.failures += 1
        self.stats.last_failure_time = datetime.now()

        if self.stats.state == CircuitState.CLOSED:
            if self.stats.failures >= self.config.failure_threshold:
                logger.warning(
                    f"Circuit breaker {self.name} opening after {self.stats.failures} failures"
                )
                self.stats.state = CircuitState.OPEN
                self.stats.opened_at = datetime.now()
        elif self.stats.state == CircuitState.HALF_OPEN:
            # Failure in half-open, go back to open
            logger.warning(f"Circuit breaker {self.name} reopening after failure in half-open")
            self.stats.state = CircuitState.OPEN
            self.stats.opened_at = datetime.now()
            self.stats.successes = 0

    def get_state(self) -> Dict[str, Any]:
        """Get current circuit breaker state"""
        return {
            "name": self.name,
            "state": self.stats.state.value,
            "failures": self.stats.failures,
            "successes": self.stats.successes,
            "last_failure_time": (
                self.stats.last_failure_time.isoformat()
                if self.stats.last_failure_time
                else None
            ),
            "opened_at": (
                self.stats.opened_at.isoformat() if self.stats.opened_at else None
            ),
        }


class CircuitBreakerOpenError(Exception):
    """Circuit breaker is open"""
    pass


async def retry_with_backoff(
    func: Callable,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    exceptions: tuple = (Exception,),
    *args,
    **kwargs,
) -> Any:
    """
    Retry function with exponential backoff

    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        exponential_base: Base for exponential backoff
        exceptions: Tuple of exceptions to catch and retry
        *args: Function arguments
        **kwargs: Function keyword arguments

    Returns:
        Function result

    Raises:
        Last exception if all retries fail
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except exceptions as e:
            last_exception = e

            if attempt < max_retries:
                # Calculate delay with exponential backoff
                delay = min(initial_delay * (exponential_base ** attempt), max_delay)
                logger.warning(
                    f"Retry attempt {attempt + 1}/{max_retries} after {delay:.2f}s: {e}"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(f"All {max_retries + 1} retry attempts failed")
                raise last_exception

    # Should not reach here
    if last_exception:
        raise last_exception
    raise RuntimeError("Retry logic error")


# Global circuit breakers registry
_circuit_breakers: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
    """Get or create circuit breaker"""
    if name not in _circuit_breakers:
        _circuit_breakers[name] = CircuitBreaker(name, config)
    return _circuit_breakers[name]


def get_all_circuit_breakers() -> Dict[str, Dict[str, Any]]:
    """Get state of all circuit breakers"""
    return {name: cb.get_state() for name, cb in _circuit_breakers.items()}

