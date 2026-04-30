"""Reject spoofed X-User-Id when IDENTITY_HMAC_SECRET is set (gateway must sign identity).

Pure ASGI middleware — avoids the per-request task/pipe overhead of
``BaseHTTPMiddleware`` which compounds on single-worker uvicorn and can delay
lightweight responses (e.g. ``/api/v1/config``) past the client-side timeout.
"""

from __future__ import annotations

import logging
import os

from api.common import get_caller_id
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)

_IDENTITY_HMAC_SECRET = os.environ.get("IDENTITY_HMAC_SECRET", "").strip()


def _is_production() -> bool:
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


def _should_enforce_identity_hmac() -> bool:
    """Enforce signed X-User-Id when secret exists and (prod or ENFORCE_IDENTITY_HMAC=1)."""
    if not _IDENTITY_HMAC_SECRET:
        return False
    if os.environ.get("DISABLE_IDENTITY_HMAC_ENFORCEMENT", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return False
    if os.environ.get("ENFORCE_IDENTITY_HMAC", "").strip().lower() in (
        "1",
        "true",
        "yes",
    ):
        return True
    return _is_production()


_SKIP_PREFIXES: tuple[str, ...] = (
    "/health",
    "/docs",
    "/openapi.json",
    "/metrics",
    "/api/v1/storage/webhooks",
    "/api/v1/config",
    "/favicon",
)


def _header_value(raw_headers: list[tuple[bytes, bytes]], name: bytes) -> str:
    """Extract a single header value (case-insensitive) from raw ASGI headers."""
    lower = name.lower()
    for k, v in raw_headers:
        if k.lower() == lower:
            return v.decode("latin-1").strip()
    return ""


class SpoofedIdentityMiddleware:
    """Pure ASGI middleware that rejects spoofed X-User-Id headers."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            await self.app(scope, receive, send)
            return

        raw_headers: list[tuple[bytes, bytes]] = scope.get("headers", [])
        uid = _header_value(raw_headers, b"x-user-id")
        if not uid:
            await self.app(scope, receive, send)
            return

        if not _should_enforce_identity_hmac():
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        trusted = get_caller_id(request)
        if trusted is None:
            rid = _header_value(raw_headers, b"x-request-id")
            logger.warning(
                "[security] rejected spoofed or unsigned X-User-Id path=%s request_id=%s",
                path,
                rid,
            )
            response = JSONResponse(
                status_code=401,
                content={
                    "detail": "Invalid identity signature for X-User-Id",
                    "code": "IDENTITY_SIGNATURE_REQUIRED",
                },
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)
