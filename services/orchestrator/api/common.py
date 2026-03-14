"""Shared auth and request helpers for API routes."""

from __future__ import annotations

from fastapi import HTTPException, Request


def get_caller_id(request: Request | None) -> str | None:
    """Extract authenticated user id from gateway-injected header."""
    if not request:
        return None
    return (
        request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
    ).strip() or None


def assert_workflow_owner(w: dict, request: Request | None) -> None:
    """Raise 403 if authenticated user does not own the workflow."""
    if not request:
        return
    caller = get_caller_id(request)
    owner = w.get("user_id") or ""
    wallet_owner = w.get("wallet_user_id") or ""
    effective_owner = owner or wallet_owner
    if effective_owner and effective_owner != "anonymous":
        if not caller:
            raise HTTPException(status_code=403, detail="Access denied")
        if caller != owner and caller != wallet_owner:
            raise HTTPException(status_code=403, detail="Access denied")
