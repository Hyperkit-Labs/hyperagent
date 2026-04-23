"""Execution backend abstraction for high-security backend execution.
OpenSandboxBackend uses E2B (AsyncSandbox) when E2B_API_KEY is set, otherwise OpenSandbox SDK when OPENSANDBOX_* is set.
LocalBackend is dev-only (EXECUTION_BACKEND_FORCE_LOCAL)."""

from .protocol import (
    ExecutionBackend,
    ExecutionBackendConfigurationError,
    CompileResult,
    AuditResult,
    ExploitSimResult,
    GasBenchmarkResult,
)
from .local import LocalBackend
from .opensandbox import OpenSandboxBackend
from .factory import get_execution_backend

__all__ = [
    "ExecutionBackend",
    "ExecutionBackendConfigurationError",
    "CompileResult",
    "AuditResult",
    "ExploitSimResult",
    "GasBenchmarkResult",
    "LocalBackend",
    "OpenSandboxBackend",
    "get_execution_backend",
]
