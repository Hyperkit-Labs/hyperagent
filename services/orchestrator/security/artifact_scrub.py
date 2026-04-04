"""Reject secret-bearing content before IPFS/Pinata pinning."""

from __future__ import annotations

import re
from typing import Any

_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"sk-[A-Za-z0-9]{10,}", re.I), "[redacted-openai-key]"),
    (re.compile(r"sk_live_[A-Za-z0-9]{10,}", re.I), "[redacted-stripe]"),
    (re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}", re.I), "[redacted-slack-token]"),
    (re.compile(r"AKIA[A-Z0-9]{16}", re.I), "[redacted-aws-ak]"),
    (re.compile(r"ghp_[A-Za-z0-9]{20,}", re.I), "[redacted-github-pat]"),
    (re.compile(r"0x[a-f0-9]{64}", re.I), "[redacted-hex-64]"),
)

_SENSITIVE_KEY_SUBSTR = (
    "api_key",
    "apikey",
    "secret",
    "password",
    "token",
    "private_key",
    "mnemonic",
    "authorization",
)


def scrub_for_ipfs(value: Any) -> Any:
    """Deep-copy safe structure for pinning: redacts obvious secrets and sensitive keys."""
    if isinstance(value, dict):
        out: dict[str, Any] = {}
        for k, v in value.items():
            lk = k.lower()
            if any(s in lk for s in _SENSITIVE_KEY_SUBSTR):
                out[k] = "[redacted]"
                continue
            out[k] = scrub_for_ipfs(v)
        return out
    if isinstance(value, list):
        return [scrub_for_ipfs(x) for x in value]
    if isinstance(value, str):
        s = value
        for rx, repl in _PATTERNS:
            s = rx.sub(repl, s)
        return s
    return value


def assert_safe_for_ipfs(value: Any) -> None:
    """Raise ValueError if obvious secret material remains after scrub."""
    scrubbed = scrub_for_ipfs(value)
    raw = repr(scrubbed) if not isinstance(scrubbed, str) else scrubbed
    for rx, _ in _PATTERNS:
        if rx.search(raw):
            raise ValueError("artifact_scrub: blocked pin due to suspected secret pattern")
