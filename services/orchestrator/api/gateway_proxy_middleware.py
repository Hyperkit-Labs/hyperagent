"""Reject direct non-public traffic to the orchestrator in production.

The intended operator model is:
- browser / public clients -> API gateway -> orchestrator
- internal services -> orchestrator with X-Internal-Token

In production, non-public orchestrator routes must not be called directly from
the public internet. The gateway marks proxied requests with X-Gateway-Proxy: 1.
"""

from __future__ import annotations

import hmac
import os

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


def _is_production() -> bool:
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


def _enforce_gateway_proxy_boundary() -> bool:
    if os.environ.get("DISABLE_GATEWAY_PROXY_ENFORCEMENT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return False
    return _is_production()


_PUBLIC_PREFIXES: tuple[str, ...] = (
    "/health",
    "/docs",
    "/openapi.json",
    "/metrics",
    "/favicon",
    "/api/v1/config",
    "/api/v1/networks",
    "/api/v1/tokens/stablecoins",
    "/api/v1/platform/track-record",
    "/api/v1/storage/webhooks",
    "/api/v1/simulation/webhooks",
    "/api/v1/x402/settlement",
)


def _header_value(raw_headers: list[tuple[bytes, bytes]], name: bytes) -> str:
    lower = name.lower()
    for k, v in raw_headers:
        if k.lower() == lower:
            return v.decode("latin-1").strip()
    return ""


def _has_valid_internal_token(raw_headers: list[tuple[bytes, bytes]]) -> bool:
    configured = os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    if not configured:
        return False
    provided = _header_value(raw_headers, b"x-internal-token")
    if not provided:
        return False
    return hmac.compare_digest(provided, configured)


class GatewayProxyBoundaryMiddleware:
    """Require gateway proxy or internal token for non-public production traffic."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if not _enforce_gateway_proxy_boundary():
            await self.app(scope, receive, send)
            return

        path = (scope.get("path") or "").rstrip("/") or "/"
        if any(path.startswith(prefix) for prefix in _PUBLIC_PREFIXES):
            await self.app(scope, receive, send)
            return

        raw_headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
        gateway_proxy = _header_value(raw_headers, b"x-gateway-proxy")
        if _has_valid_internal_token(raw_headers):
            await self.app(scope, receive, send)
            return

        response = JSONResponse(
            status_code=403,
            content={
                "detail": "Direct access to orchestrator is forbidden; use the API gateway with a trusted internal token hop.",
                "code": "GATEWAY_PROXY_REQUIRED",
                "gateway_proxy_seen": gateway_proxy == "1",
            },
        )
        await response(scope, receive, send)
