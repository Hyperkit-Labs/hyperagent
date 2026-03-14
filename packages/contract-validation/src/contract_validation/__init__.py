"""Shared contract name validation. Reject path traversal and invalid identifiers."""

from __future__ import annotations

import re
from pathlib import Path

_SAFE_CONTRACT_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")
_SAFE_SOL_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+\.sol$")


def safe_contract_name(name: str | None) -> str:
    """Validate and return a safe contract name. Raises ValueError on invalid input."""
    if name is None or not isinstance(name, str):
        raise ValueError("Invalid contract name")
    s = name.strip()
    if not s:
        raise ValueError("Contract name must not be empty")
    if ".." in s or "/" in s or ("\\" in s) or s.startswith("."):
        raise ValueError("Contract name must not contain path components")
    base = Path(s).name
    if not _SAFE_CONTRACT_NAME_PATTERN.match(base):
        raise ValueError("Contract name must match [a-zA-Z0-9_]+")
    return base


def safe_sol_filename(name: str | None) -> str:
    """Validate and return a safe .sol filename. Raises ValueError on invalid input."""
    if not name or not isinstance(name, str):
        raise ValueError("Invalid filename")
    base = Path(name).name
    if ".." in name or "/" in name or "\\" in name:
        raise ValueError("Filename must not contain path components")
    if not _SAFE_SOL_PATTERN.match(base):
        raise ValueError("Filename must match [a-zA-Z0-9_.-]+.sol")
    return base
