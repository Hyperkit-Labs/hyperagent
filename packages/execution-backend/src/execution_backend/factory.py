"""Factory for execution backend selection."""

import logging
import os
from typing import TYPE_CHECKING

from .local import LocalBackend
from .opensandbox import OpenSandboxBackend

if TYPE_CHECKING:
    from .protocol import ExecutionBackend

logger = logging.getLogger(__name__)

# Dev-only: bypass OpenSandbox and use HTTP LocalBackend (not for production).
EXECUTION_BACKEND_FORCE_LOCAL = os.environ.get(
    "EXECUTION_BACKEND_FORCE_LOCAL", "false"
).strip().lower() in ("1", "true", "yes")


def get_execution_backend() -> "ExecutionBackend":
    """Return OpenSandboxBackend (E2B primary, OpenSandbox SDK fallback) by default.

    Set EXECUTION_BACKEND_FORCE_LOCAL=true only for local development without a sandbox.
    """
    if EXECUTION_BACKEND_FORCE_LOCAL:
        logger.warning(
            "EXECUTION_BACKEND_FORCE_LOCAL is set: using LocalBackend (dev-only). "
            "Production must set E2B_API_KEY (E2B) and/or OpenSandbox credentials."
        )
        return LocalBackend()
    return OpenSandboxBackend()
