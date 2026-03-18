"""Local execution backend: uses existing HTTP services (compile, audit)."""

import os
from typing import Any

import httpx

from .protocol import AuditResult, CompileResult, ExploitSimResult, GasBenchmarkResult

COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001").rstrip("/")
TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")
TOOLS_API_KEY = os.environ.get("TOOLS_API_KEY", "")


class LocalBackend:
    """Local backend: proxies to compile and audit HTTP services."""

    def __init__(
        self,
        compile_url: str | None = None,
        audit_url: str | None = None,
        tools_url: str | None = None,
        tools_key: str | None = None,
    ):
        self.compile_url = compile_url or COMPILE_SERVICE_URL
        self.audit_url = audit_url or AUDIT_SERVICE_URL
        self.tools_url = tools_url or TOOLS_BASE_URL
        self.tools_key = tools_key or TOOLS_API_KEY

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {"Content-Type": "application/json"}
        if self.tools_key and self.tools_url:
            h["Authorization"] = f"Bearer {self.tools_key}"
            h["X-API-Key"] = self.tools_key
        return h

    async def run_compile(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
    ) -> CompileResult:
        """Run compile via HTTP."""
        url = f"{self.compile_url}/compile"
        if self.tools_url:
            url = f"{self.tools_url}/compile"
        payload: dict[str, Any] = {"contractCode": contract_code, "framework": framework}
        if files:
            payload["files"] = files
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(url, json=payload, headers=self._headers())
                r.raise_for_status()
                data = r.json()
                errors = data.get("errors") or []
                if isinstance(errors, list) and errors and isinstance(errors[0], dict):
                    errors = [e.get("message", str(e)) for e in errors]
                return CompileResult(
                    success=data.get("success", False),
                    bytecode=data.get("bytecode"),
                    abi=data.get("abi"),
                    errors=errors,
                    contract_name=data.get("contractName"),
                )
        except Exception as e:
            return CompileResult(success=False, errors=[str(e)])

    async def run_audit(
        self,
        contract_code: str,
        contract_name: str,
        tools: list[str] | None = None,
        on_log: None | ((str, str) -> None) = None,
    ) -> AuditResult:
        """Run audit via HTTP. on_log ignored (no streaming from HTTP audit service)."""
        url = f"{self.audit_url}/audit"
        if self.tools_url:
            url = f"{self.tools_url}/audit"
        tool_list = tools or ["slither", "mythril"]
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                r = await client.post(
                    url,
                    params={"tool": ",".join(tool_list)},
                    json={"contractCode": contract_code, "contractName": contract_name},
                    headers=self._headers(),
                )
                r.raise_for_status()
                data = r.json()
                findings = data.get("findings", [])
                if isinstance(findings, list) and findings and isinstance(findings[0], dict):
                    pass
                else:
                    findings = []
                tools_run = data.get("tools_run", tool_list)
                tools_failed = data.get("tools_failed", [])
                return AuditResult(findings=findings, tools_run=tools_run, tools_failed=tools_failed)
        except Exception:
            return AuditResult(
                findings=[{"severity": "high", "title": "Audit service unavailable", "description": "Could not reach audit service"}],
                tools_run=[],
                tools_failed=tool_list,
            )

    async def run_exploit_sim(
        self,
        contracts: dict[str, str],
        spec: dict[str, Any],
        design: dict[str, Any],
    ) -> ExploitSimResult:
        """Exploit sim: LocalBackend has no implementation. Fail closed."""
        return ExploitSimResult(
            passed=False,
            findings=[{
                "severity": "high",
                "title": "Exploit simulation not implemented",
                "description": "LocalBackend does not run exploit tests. Set OPENSANDBOX_ENABLED=true and configure OpenSandbox for real exploit simulation.",
                "tool": "execution-backend",
            }],
        )

    async def run_gas_benchmark(
        self,
        contract_code: str,
        contract_name: str,
        configs: list[dict[str, Any]] | None = None,
    ) -> GasBenchmarkResult:
        """Gas benchmark: not implemented for LocalBackend; returns default score."""
        return GasBenchmarkResult(score=0.0, configs=[], bytecode_sizes=[])
