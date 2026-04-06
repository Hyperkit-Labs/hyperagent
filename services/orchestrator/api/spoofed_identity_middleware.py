"""Reject spoofed X-User-Id when IDENTITY_HMAC_SECRET is set (gateway must sign identity)."""

from __future__ import annotations

import logging
import os

from api.common import get_caller_id
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

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
    "/favicon",
)


class SpoofedIdentityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path or ""
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return await call_next(request)

        uid = (
            request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
        ).strip()
        if not uid:
            return await call_next(request)

        if not _should_enforce_identity_hmac():
            return await call_next(request)

        trusted = get_caller_id(request)
        if trusted is None:
            rid = (
                request.headers.get("x-request-id")
                or request.headers.get("X-Request-Id")
                or ""
            )
            logger.warning(
                "[security] rejected spoofed or unsigned X-User-Id path=%s request_id=%s",
                path,
                rid,
            )
            return JSONResponse(
                status_code=401,
                content={
                    "detail": "Invalid identity signature for X-User-Id",
                    "code": "IDENTITY_SIGNATURE_REQUIRED",
                },
            )
        return await call_next(request)
