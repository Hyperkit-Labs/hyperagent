"""Execution backend protocol for compile, audit, and exploit simulation."""

from typing import Any, Protocol


class CompileResult:
    """Result of a compile job."""

    def __init__(
        self,
        success: bool,
        bytecode: str | None = None,
        abi: list | None = None,
        errors: list[str] | None = None,
        contract_name: str | None = None,
    ):
        self.success = success
        self.bytecode = bytecode
        self.abi = abi
        self.errors = errors or []
        self.contract_name = contract_name


class AuditResult:
    """Result of an audit job."""

    def __init__(
        self,
        findings: list[dict[str, Any]],
        tools_run: list[str],
        tools_failed: list[str] | None = None,
    ):
        self.findings = findings
        self.tools_run = tools_run
        self.tools_failed = tools_failed or []


class ExploitSimResult:
    """Result of exploit simulation."""

    def __init__(self, passed: bool, findings: list[dict[str, Any]]):
        self.passed = passed
        self.findings = findings


class GasBenchmarkResult:
    """Result of gas benchmarking across compiler configs."""

    def __init__(
        self,
        score: float,
        configs: list[dict[str, Any]],
        bytecode_sizes: list[int],
    ):
        self.score = score
        self.configs = configs
        self.bytecode_sizes = bytecode_sizes


class ExecutionBackend(Protocol):
    """Protocol for execution backends (Local, OpenSandbox)."""

    async def run_compile(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
    ) -> CompileResult:
        """Run Solidity compilation. Returns bytecode, ABI, errors."""
        ...

    async def run_audit(
        self,
        contract_code: str,
        contract_name: str,
        tools: list[str] | None = None,
    ) -> AuditResult:
        """Run security audit (Slither, Mythril, etc.). Returns findings."""
        ...

    async def run_exploit_sim(
        self,
        contracts: dict[str, str],
        spec: dict[str, Any],
        design: dict[str, Any],
    ) -> ExploitSimResult:
        """Run exploit PoC tests. Returns passed flag and findings."""
        ...

    async def run_gas_benchmark(
        self,
        contract_code: str,
        contract_name: str,
        configs: list[dict[str, Any]] | None = None,
    ) -> GasBenchmarkResult:
        """Run gas benchmark across compiler configs. Returns score and bytecode sizes."""
        ...
