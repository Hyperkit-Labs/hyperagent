"""Deterministic input guardrail: blocks malicious prompts before they reach the LLM.
Per Render security best practices: validate input before data enters the LLM context window.
Uses deny-list for known attack phrases; optional allow-list for domain-specific topics."""

from __future__ import annotations

import logging
import re
from typing import Tuple

logger = logging.getLogger(__name__)

# Deny-list: phrases that indicate prompt injection or malicious intent.
# Case-insensitive substring match. Extend as new attack patterns are identified.
FORBIDDEN_TERMS: tuple[str, ...] = (
    "ignore instructions",
    "ignore previous",
    "ignore all",
    "disregard instructions",
    "disregard previous",
    "forget everything",
    "forget your instructions",
    "system_override",
    "system override",
    "override system",
    "bypass",
    "jailbreak",
    "new instructions",
    "you are now",
    "pretend you are",
    "act as if",
    "drop table",
    "drop database",
    "delete all",
    "delete database",
    "truncate table",
    "exec(",
    "eval(",
    "execute(",
    "rm -rf",
    "format c:",
    "reveal your prompt",
    "show your prompt",
    "repeat your instructions",
    "output your system prompt",
    "what are your instructions",
    "developer mode",
    "dan mode",
    "do anything now",
)

# Optional: regex patterns for structural attacks (e.g. XML injection attempts).
FORBIDDEN_PATTERNS: tuple[str, ...] = (
    r"<system[^>]*>.*?</system>",
    r"\[INST\].*?\[/INST\]",
    r"```system\b",
)


def validate_input(user_prompt: str) -> Tuple[bool, str | None]:
    """Validate user prompt against deny-list. Returns (passed, violation_message).
    If passed=True, violation_message is None. If passed=False, violation_message describes the block."""
    if not user_prompt or not isinstance(user_prompt, str):
        return False, "Empty or invalid input"

    text = user_prompt.strip()
    if not text:
        return False, "Empty input"

    lower = text.lower()

    for term in FORBIDDEN_TERMS:
        if term.lower() in lower:
            logger.warning("[guardrail] blocked prompt: forbidden term=%r", term)
            return False, f"Security policy violation: input contains prohibited content"

    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.DOTALL):
            logger.warning("[guardrail] blocked prompt: forbidden pattern=%r", pattern)
            return False, "Security policy violation: input contains prohibited content"

    return True, None


def validate_and_raise(user_prompt: str) -> None:
    """Validate user prompt; raise ValueError with violation message if blocked."""
    passed, violation = validate_input(user_prompt)
    if not passed:
        raise ValueError(violation or "Security policy violation")
