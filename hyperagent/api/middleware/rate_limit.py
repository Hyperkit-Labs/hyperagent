"""Unified rate limiting middleware and service"""

import asyncio
import logging
import os
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.exceptions import RateLimitError

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Unified Rate Limiter

    Concept: Prevent API abuse by limiting requests per time window
    Logic: Track request counts per identifier (IP/user/wallet/network), enforce limits
    Storage: Redis for distributed rate limiting, in-memory fallback
    
    Supports:
    - General API rate limiting (per IP/user)
    - Deployment rate limiting (per wallet/network)
    - Custom rate limiting (per any identifier)
    """

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        self.redis = redis_manager
        # Fallback to in-memory if Redis not available
        self._memory_store: Dict[str, Tuple[int, float]] = defaultdict(lambda: (0, time.time()))
        
        # Deployment-specific limits (configurable via env vars)
        self.deployment_per_wallet_limit = int(os.getenv("DEPLOYMENT_RATE_LIMIT_PER_WALLET", "10"))
        self.deployment_per_network_limit = int(os.getenv("DEPLOYMENT_RATE_LIMIT_PER_NETWORK", "100"))
        self.deployment_window_seconds = 3600  # 1 hour

    async def check_rate_limit(
        self, identifier: str, max_requests: int = 100, window_seconds: int = 60
    ) -> Tuple[bool, int]:
        """
        Check if request is within rate limit

        Args:
            identifier: Unique identifier (IP, user ID, wallet address, etc.)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds

        Returns:
            (allowed: bool, remaining: int)

        Logic:
        1. Get current count for identifier
        2. Check if count < max_requests
        3. Increment count if allowed
        4. Reset window if expired
        """
        if self.redis and self.redis.client:
            return await self._check_redis(identifier, max_requests, window_seconds)
        else:
            return await self._check_memory(identifier, max_requests, window_seconds)
    
    async def check_deployment_rate_limit(
        self,
        wallet_address: str,
        network: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check deployment rate limit (per wallet and per network)
        
        Args:
            wallet_address: User wallet address
            network: Target network
            
        Returns:
            (allowed: bool, error_message: Optional[str])
        """
        if not self.redis:
            logger.warning("Redis not configured, deployment rate limiting disabled")
            return True, None
        
        # Check per-wallet limit
        wallet_key = f"rate_limit:deployment:wallet:{wallet_address.lower()}"
        wallet_count = await self._get_count(wallet_key)
        
        if wallet_count >= self.deployment_per_wallet_limit:
            retry_after = await self._get_retry_after(wallet_key)
            return False, (
                f"Rate limit exceeded: max {self.deployment_per_wallet_limit} deployments per hour. "
                f"Retry after {retry_after} seconds."
            )
        
        # Check per-network limit
        network_key = f"rate_limit:deployment:network:{network}"
        network_count = await self._get_count(network_key)
        
        if network_count >= self.deployment_per_network_limit:
            retry_after = await self._get_retry_after(network_key)
            return False, (
                f"Network rate limit exceeded: max {self.deployment_per_network_limit} deployments per hour. "
                f"Retry after {retry_after} seconds."
            )
        
        return True, None
    
    async def increment_deployment(
        self,
        wallet_address: str,
        network: str
    ):
        """
        Increment deployment counters after successful deployment
        
        Args:
            wallet_address: User wallet address
            network: Target network
        """
        if not self.redis:
            return
        
        wallet_key = f"rate_limit:deployment:wallet:{wallet_address.lower()}"
        network_key = f"rate_limit:deployment:network:{network}"
        
        await self._increment_counter(wallet_key, self.deployment_window_seconds)
        await self._increment_counter(network_key, self.deployment_window_seconds)
        
        logger.info(
            f"Deployment rate limit incremented for wallet={wallet_address}, network={network}"
        )
    
    async def get_deployment_remaining(
        self,
        wallet_address: str,
        network: str
    ) -> Dict[str, int]:
        """
        Get remaining deployment allowance
        
        Returns:
            {
                "wallet_remaining": int,
                "network_remaining": int,
                "wallet_limit": int,
                "network_limit": int,
                "window_seconds": int
            }
        """
        wallet_key = f"rate_limit:deployment:wallet:{wallet_address.lower()}"
        network_key = f"rate_limit:deployment:network:{network}"
        
        wallet_count = await self._get_count(wallet_key)
        network_count = await self._get_count(network_key)
        
        return {
            "wallet_remaining": max(0, self.deployment_per_wallet_limit - wallet_count),
            "network_remaining": max(0, self.deployment_per_network_limit - network_count),
            "wallet_limit": self.deployment_per_wallet_limit,
            "network_limit": self.deployment_per_network_limit,
            "window_seconds": self.deployment_window_seconds
        }

    async def _check_redis(
        self, identifier: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, int]:
        """Rate limit check using Redis"""
        if not self.redis or not self.redis.client:
            # Fallback to memory if Redis not available
            return await self._check_memory(identifier, max_requests, window_seconds)

        key = f"ratelimit:{identifier}"
        current_time = time.time()

        # Use Redis pipeline for atomic operations
        pipe = self.redis.client.pipeline()
        pipe.zremrangebyscore(key, 0, current_time - window_seconds)
        pipe.zcard(key)
        pipe.zadd(key, {str(current_time): current_time})
        pipe.expire(key, window_seconds)
        results = await pipe.execute()

        count = results[1]
        allowed = count < max_requests

        if allowed:
            remaining = max_requests - count - 1
        else:
            remaining = 0

        return allowed, remaining

    async def _check_memory(
        self, identifier: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, int]:
        """Rate limit check using in-memory store"""
        current_time = time.time()
        count, window_start = self._memory_store[identifier]

        # Reset window if expired
        if current_time - window_start >= window_seconds:
            count = 0
            window_start = current_time

        # Check limit
        if count >= max_requests:
            return False, 0

        # Increment count
        count += 1
        self._memory_store[identifier] = (count, window_start)

        remaining = max_requests - count
        return True, remaining
    
    async def _get_count(self, key: str) -> int:
        """Get current count for rate limit key"""
        if not self.redis or not self.redis.client:
            return 0
        
        value = await self.redis.get(key)
        return int(value) if value else 0
    
    async def _increment_counter(self, key: str, ttl: int):
        """Increment counter with sliding window expiry"""
        if not self.redis or not self.redis.client:
            return
        
        # Increment and set expiry if new key
        current_value = await self.redis.get(key)
        
        if current_value is None:
            # New key, set with expiry
            await self.redis.set(key, "1", ttl=ttl)
        else:
            # Existing key, increment (expiry already set)
            await self.redis.client.incr(key)
    
    async def _get_retry_after(self, key: str) -> int:
        """Get seconds until rate limit resets"""
        if not self.redis or not self.redis.client:
            return 0
        
        ttl = await self.redis.client.ttl(key)
        return max(0, ttl)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate Limiting Middleware

    Concept: Apply rate limits to all API requests
    Logic: Extract identifier (IP or user), check limits, enforce
    """

    def __init__(self, app, rate_limiter: RateLimiter):
        super().__init__(app)
        self.rate_limiter = rate_limiter
        # Rate limit configs per endpoint
        self.limits = {
            "/api/v1/workflows/generate": (10, 60),  # 10 per minute
            "/api/v1/contracts/generate": (20, 60),  # 20 per minute
            "/api/v1/contracts/audit": (30, 60),  # 30 per minute
            "default": (100, 60),  # 100 per minute default
        }

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and metrics
        if request.url.path in ["/api/v1/health", "/api/v1/metrics/prometheus"]:
            return await call_next(request)

        # Get identifier (IP address or user ID)
        identifier = self._get_identifier(request)

        # Get rate limit config for endpoint
        max_requests, window = self.limits.get(request.url.path, self.limits["default"])

        # Check rate limit
        allowed, remaining = await self.rate_limiter.check_rate_limit(
            identifier, max_requests, window
        )

        if not allowed:
            raise RateLimitError(
                f"Rate limit exceeded. Max {max_requests} requests per {window} seconds.",
                details={
                    "limit": max_requests,
                    "window": window,
                    "identifier": identifier,
                    "endpoint": request.url.path,
                },
            )

        # Add rate limit headers to response
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)

        return response

    def _get_identifier(self, request: Request) -> str:
        """Extract identifier from request (IP or user ID)"""
        # Try to get user ID from auth token
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from hyperagent.api.middleware.auth import AuthManager

                token = auth_header.split(" ")[1]
                payload = AuthManager.verify_token(token)
                return f"user:{payload['user_id']}"
            except Exception:
                # Token validation failed, fall back to IP-based rate limiting
                pass

        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        return f"ip:{client_ip}"
