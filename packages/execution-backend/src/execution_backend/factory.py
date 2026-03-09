"""Factory for execution backend selection."""

import os
from typing import TYPE_CHECKING

from .local import LocalBackend
from .opensandbox import OpenSandboxBackend

if TYPE_CHECKING:
    from .protocol import ExecutionBackend

OPENSANDBOX_ENABLED = os.environ.get("OPENSANDBOX_ENABLED", "false").strip().lower() in ("1", "true", "yes")


def get_execution_backend() -> "ExecutionBackend":
    """Return OpenSandboxBackend when OPENSANDBOX_ENABLED, else LocalBackend."""
    if OPENSANDBOX_ENABLED:
        return OpenSandboxBackend()
    return LocalBackend()
