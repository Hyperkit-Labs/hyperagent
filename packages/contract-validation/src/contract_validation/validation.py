"""
Safe contract name and filename validation.
Prevents path traversal and invalid characters for filesystem use.
"""

import os
import re
from pathlib import Path

# Safe filename: basename only, [a-zA-Z0-9_.-]+\.sol (path traversal prevention)
_SAFE_SOL_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+\.sol$")
# Safe contract name: Solidity identifier [a-zA-Z0-9_]+ (path traversal prevention)
_SAFE_CONTRACT_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


class ValidationError(Exception):
    """Raised when contract name or filename fails validation."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def safe_contract_name(name: str | None) -> str:
    """Validate and return a safe contract name for path construction. Reject path traversal."""
    if name is None or not isinstance(name, str):
        raise ValidationError("Invalid contract name")
    s = name.strip()
    if not s:
        raise ValidationError("Contract name must not be empty")
    if ".." in s or "/" in s or ("\\" in s) or s.startswith("."):
        raise ValidationError("Contract name must not contain path components")
    base = Path(s).name
    if not _SAFE_CONTRACT_NAME_PATTERN.match(base):
        raise ValidationError("Contract name must match [a-zA-Z0-9_]+")
    return base


def safe_sol_filename(name: str | None) -> str:
    """Return a safe .sol filename for use in temp dirs. Reject path traversal and invalid names."""
    if not name or not isinstance(name, str):
        raise ValidationError("Invalid filename")
    base = Path(name).name
    if ".." in name or os.sep in name or (os.altsep and os.altsep in name):
        raise ValidationError("Filename must not contain path components")
    if not _SAFE_SOL_PATTERN.match(base):
        raise ValidationError("Filename must match [a-zA-Z0-9_.-]+.sol")
    return base
