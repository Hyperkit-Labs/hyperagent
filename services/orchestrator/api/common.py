"""Shared auth and request helpers for orchestrator API routes."""

import hashlib
import hmac
import json
import logging
import os
import re
import time
from base64 import urlsafe_b64decode
from typing import Any

from fastapi import HTTPException, Request

_SAFE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9 _\-]{1,64}$")
_SECRET_LIKE = re.compile(
    r"(sk-[a-zA-Z0-9]{10,}|xox[baprs]-[a-zA-Z0-9-]{10,}|"
    r"api[_-]?key\s*[=:]\s*\S+|Bearer\s+[a-zA-Z0-9._-]{20,}|"
    r"OPENAI_API_KEY|ANTHROPIC_API_KEY|AIza[0-9A-Za-z_-]{20,})",
    re.I,
)

logger = logging.getLogger(__name__)

_IDENTITY_HMAC_SECRET = os.environ.get("IDENTITY_HMAC_SECRET", "").strip()


def _verify_user_id_hmac(user_id: str, sig_header: str) -> bool:
    """Verify HMAC signature on X-User-Id sent by the gateway."""
    if not _IDENTITY_HMAC_SECRET:
        return True
    if not sig_header:
        return False
    dot = sig_header.rfind(".")
    if dot < 1:
        return False
    uid_from_sig = sig_header[:dot]
    sig_hex = sig_header[dot + 1 :]
    if uid_from_sig != user_id:
        return False
    expected = hmac.new(
        _IDENTITY_HMAC_SECRET.encode(), user_id.encode(), hashlib.sha256
    ).hexdigest()
    try:
        return hmac.compare_digest(sig_hex, expected)
    except Exception:
        return False


def redact_error_for_storage(msg: str, max_len: int = 2000) -> str:
    """Strip possible secrets before persisting workflow/run error text."""
    if not msg:
        return ""
    head = msg[:768]
    if _SECRET_LIKE.search(head):
        return "Pipeline error (redacted: possible secret in message)."
    return msg[:max_len]


def redact_error_for_logs(msg: str, max_len: int = 240) -> str:
    """Short log line without echoing key material."""
    if not msg:
        return ""
    if _SECRET_LIKE.search(msg[:512]):
        return "[redacted]"
    return msg[:max_len]


def _log_byok_event(event: str, user_id: str, action: str) -> None:
    """Structured security log for BYOK access (no key values)."""
    logger.warning(
        "[security] %s",
        json.dumps({"event": event, "byok_action": action, "user_id": user_id}),
    )


def _get_keys_for_run(user_id: str, workspace_id: str) -> dict[str, str]:
    """Resolve BYOK keys: Supabase by user_id when configured; else in-memory by workspace for dev only.

    Exceptions are caught and redacted so that key material in error messages
    never propagates into logs or caller exception handlers.
    """
    import llm_keys_supabase
    from llm_keys_store import DEFAULT_WORKSPACE, get_keys_for_pipeline

    try:
        if llm_keys_supabase._is_configured():
            if user_id:
                return llm_keys_supabase.get_keys_for_user(user_id)
            return {}
        return get_keys_for_pipeline(workspace_id or DEFAULT_WORKSPACE)
    except Exception as exc:
        logger.error(
            "[byok] key resolution failed user_id=%s workspace=%s: %s",
            (user_id[:8] + "…") if user_id else "anon",
            workspace_id[:8] if workspace_id else "none",
            redact_error_for_logs(str(exc)),
        )
        return {}


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
            redact_error_for_logs(str(e)),
        )
        return None


def get_caller_id(request: Request) -> str | None:
    """Extract authenticated user id from gateway-injected header.
    When IDENTITY_HMAC_SECRET is set, verifies the x-user-id-sig HMAC.
    Rejects spoofed headers in production.
    Falls back to validated Authorization bearer sub only when X-User-Id is absent."""
    user_id = (
        request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
    ).strip() or None
    if not user_id:
        return _get_user_id_from_bearer(request)
    if _IDENTITY_HMAC_SECRET:
        sig = (request.headers.get("x-user-id-sig") or "").strip()
        if not _verify_user_id_hmac(user_id, sig):
            logger.warning(
                "[security] X-User-Id HMAC verification failed for user_id=%s path=%s",
                user_id[:16],
                request.url.path,
            )
            return None
    return user_id


def _get_user_id_from_bearer(request: Request) -> str | None:
    """Resolve wallet_users.id from gateway JWT sub when request bypasses gateway header injection."""
    secret = os.environ.get("AUTH_JWT_SECRET", "").strip()
    if not secret:
        return None
    auth = (
        request.headers.get("authorization")
        or request.headers.get("Authorization")
        or ""
    ).strip()
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    payload = _verify_gateway_jwt_hs256(token, secret)
    if payload is None:
        return None
    sub = payload.get("sub")
    if isinstance(sub, str) and sub.strip():
        return sub.strip()
    return None


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return urlsafe_b64decode((value + padding).encode())


def _verify_gateway_jwt_hs256(token: str, secret: str) -> dict[str, Any] | None:
    """Verify compact JWT signature (HS256) and return payload dict."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h_b64, p_b64, s_b64 = parts
        header = json.loads(_b64url_decode(h_b64))
        if not isinstance(header, dict) or header.get("alg") != "HS256":
            return None
        signing_input = f"{h_b64}.{p_b64}".encode()
        expected = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
        got = _b64url_decode(s_b64)
        if not hmac.compare_digest(got, expected):
            return None
        payload = json.loads(_b64url_decode(p_b64))
        if not isinstance(payload, dict):
            return None
        exp = payload.get("exp")
        if isinstance(exp, (int, float)) and time.time() >= float(exp):
            return None
        return payload
    except Exception:
        return None


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
