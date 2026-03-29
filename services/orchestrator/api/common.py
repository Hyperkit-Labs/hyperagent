"""Shared auth and request helpers for orchestrator API routes."""

import json
import logging
import re
from typing import Any

from fastapi import HTTPException, Request

_SAFE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9 _\-]{1,64}$")

logger = logging.getLogger(__name__)


def _log_byok_event(event: str, user_id: str, action: str) -> None:
    """Structured security log for BYOK access (no key values)."""
    logger.warning(
        "[security] %s",
        json.dumps({"event": event, "byok_action": action, "user_id": user_id}),
    )


def _get_keys_for_run(user_id: str, workspace_id: str) -> dict[str, str]:
    """Resolve BYOK keys: Supabase by user_id when configured; else in-memory by workspace for dev only."""
    import llm_keys_supabase
    from llm_keys_store import DEFAULT_WORKSPACE, get_keys_for_pipeline

    if llm_keys_supabase._is_configured():
        if user_id:
            return llm_keys_supabase.get_keys_for_user(user_id)
        return {}
    return get_keys_for_pipeline(workspace_id or DEFAULT_WORKSPACE)


def _create_agent_session_jwt_if_configured(
    user_id: str, run_id: str, api_keys: dict
) -> str | None:
    """When JWT_SECRET_KEY and AGENT_SESSION_PAYLOAD_KEY are set, return short-lived JWT with encrypted api_keys."""
    import os

    if not api_keys:
        return None
    if not os.environ.get("JWT_SECRET_KEY") or not os.environ.get(
        "AGENT_SESSION_PAYLOAD_KEY"
    ):
        return None
    try:
        from agent_session_jwt import create_agent_session_jwt

        return create_agent_session_jwt(sub=user_id, run_id=run_id, api_keys=api_keys)
    except Exception as e:
        logger.error(
            "[agent-session] JWT creation failed user_id=%s run_id=%s: %s",
            user_id,
            run_id,
            e,
            exc_info=True,
        )
        return None


def get_caller_id(request: Request) -> str | None:
    """Extract authenticated user id from gateway-injected header."""
    return (
        request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
    ).strip() or None


def _run_status_for_store(status: str) -> str:
    """Map store status to runs.status (pending|running|success|failed|cancelled)."""
    if status == "completed":
        return "success"
    if status == "failed":
        return "failed"
    return "running"


def _sanitize_ident(value: str, fallback: str = "fn") -> str:
    """Ensure a value is safe to embed as a JS/TS identifier."""
    if _SAFE_IDENT.match(value or ""):
        return value
    cleaned = re.sub(r"[^A-Za-z0-9_]", "", value or "")
    return cleaned[:64] if cleaned else fallback


def _sanitize_label(value: str, fallback: str = "Action") -> str:
    """Escape HTML entities in labels to prevent XSS in generated code."""
    safe = (
        (value or fallback)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return safe[:128]


def _sanitize_name(value: str, fallback: str = "dapp") -> str:
    """Validate app name for safe filesystem and display usage."""
    if _SAFE_NAME.match(value or ""):
        return value
    cleaned = re.sub(r"[^A-Za-z0-9 _\-]", "", value or "")
    return cleaned[:64] if cleaned else fallback


def assert_workflow_owner(w: dict[str, Any], request: Request) -> None:
    """Raise 403 if authenticated user does not own the workflow.
    Checks both user_id and wallet_user_id for backward compatibility
    during the identity column migration period."""
    # Remove wallet_user_id fallback once all workflows store owner as wallet_users.id in user_id.
    caller = get_caller_id(request)
    owner = w.get("user_id") or ""
    wallet_owner = w.get("wallet_user_id") or ""
    effective_owner = owner or wallet_owner
    if effective_owner and effective_owner != "anonymous":
        if not caller:
            raise HTTPException(status_code=403, detail="Access denied")
        if caller != owner and caller != wallet_owner:
            raise HTTPException(status_code=403, detail="Access denied")
