"""Execution backend abstraction for high-security backend execution.
Supports LocalBackend (current HTTP services) and OpenSandboxBackend (gVisor/Firecracker isolation)."""

from .protocol import ExecutionBackend, CompileResult, AuditResult, ExploitSimResult
from .local import LocalBackend
from .opensandbox import OpenSandboxBackend
from .factory import get_execution_backend

__all__ = [
    "ExecutionBackend",
    "CompileResult",
    "AuditResult",
    "ExploitSimResult",
    "LocalBackend",
    "OpenSandboxBackend",
    "get_execution_backend",
]
