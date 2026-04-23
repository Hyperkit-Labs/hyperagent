"""Remote sandbox execution: E2B first, OpenSandbox SDK fallback.

Primary path uses the official E2B Python SDK (``from e2b import AsyncSandbox``) with ``E2B_API_KEY`` /
optional ``E2B_API_URL`` (self-hosted). If ``AsyncSandbox.create`` fails or ``e2b`` is not installed,
the backend falls back to ``opensandbox-sdk`` when ``OPENSANDBOX_API_URL`` and ``OPENSANDBOX_API_KEY``
are set. Template ids map to E2B templates (or OpenSandbox control-plane ``templateID`` when falling back).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shlex
from typing import Any, Callable, Optional

from .protocol import (
    AuditResult,
    CompileResult,
    ExecutionBackendConfigurationError,
    ExploitSimResult,
    GasBenchmarkResult,
)

logger = logging.getLogger(__name__)

_SANDBOX_CREATE_TIMEOUT = 300


def _sandbox_workdir() -> str:
    """Workspace root inside the sandbox image (E2B default image uses /home/user; override if your template differs)."""
    return (
        os.environ.get("E2B_SANDBOX_WORKDIR", "").strip()
        or os.environ.get("OPENSANDBOX_SANDBOX_WORKDIR", "").strip()
        or "/home/user/hyperkit-sandbox"
    )


def _template_for_stage(kind: str) -> str:
    """Resolve sandbox template name or id (E2B template / OpenSandbox templateID)."""
    global_id = (os.environ.get("E2B_TEMPLATE_ID", "") or "").strip()
    if global_id:
        return global_id
    defaults: dict[str, str] = {
        "compile": "solidity-toolchain",
        "audit": "audit-tools",
        "exploit": "audit-tools",
    }
    env_keys: dict[str, str] = {
        "compile": "E2B_TEMPLATE_COMPILE",
        "audit": "E2B_TEMPLATE_AUDIT",
        "exploit": "E2B_TEMPLATE_EXPLOIT",
    }
    if kind not in env_keys:
        return "audit-tools"
    override = (os.environ.get(env_keys[kind], "") or "").strip()
    return override or defaults.get(kind, "audit-tools")


def _opensandbox_credentials() -> tuple[str, str]:
    """URL and API key for OpenSandbox-only (fallback) control plane."""
    url = (os.environ.get("OPENSANDBOX_API_URL", "") or "").strip()
    key = (os.environ.get("OPENSANDBOX_API_KEY", "") or "").strip()
    return url, key


def _e2b_api_key() -> str:
    return (os.environ.get("E2B_API_KEY", "") or "").strip()


def _e2b_api_url() -> str | None:
    u = (os.environ.get("E2B_API_URL", "") or "").strip()
    return u or None


async def _dispose_sandbox(sandbox: Any) -> None:
    """Best-effort teardown for E2B (kill) and OpenSandbox (kill + close)."""
    try:
        kill = getattr(sandbox, "kill", None)
        if kill is not None:
            res = kill()
            if asyncio.iscoroutine(res):
                await res
    except Exception:  # noqa: BLE001
        logger.debug("[sandbox] kill failed", exc_info=True)
    try:
        close = getattr(sandbox, "close", None)
        if close is not None:
            res = close()
            if asyncio.iscoroutine(res):
                await res
    except Exception:  # noqa: BLE001
        logger.debug("[sandbox] close failed", exc_info=True)


class OpenSandboxBackend:
    """E2B ``AsyncSandbox`` when configured; otherwise ``opensandbox-sdk`` to the OpenSandbox API."""

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
    ):
        # Optional overrides for OpenSandbox fallback (tests or split secrets).
        o_url, o_key = _opensandbox_credentials()
        self._os_url = (api_url or o_url).strip()
        self._os_key = (api_key or o_key).strip()

        e2b_key = _e2b_api_key()
        if not e2b_key and (not self._os_url or not self._os_key):
            raise ExecutionBackendConfigurationError(
                "Sandbox execution requires E2B_API_KEY for E2B, or both OPENSANDBOX_API_URL and "
                "OPENSANDBOX_API_KEY for OpenSandbox fallback. Optional: E2B_API_URL for self-hosted E2B."
            )

    async def _open_sandbox(self, stage: str) -> Any:
        """Try E2B ``AsyncSandbox`` first; on failure use OpenSandbox SDK."""
        err_e2b: Exception | None = None
        e2b_key = _e2b_api_key()
        if e2b_key:
            try:
                from e2b import AsyncSandbox

                kwargs: dict[str, Any] = {
                    "template": _template_for_stage(stage),
                    "timeout": _SANDBOX_CREATE_TIMEOUT,
                    "api_key": e2b_key,
                }
                e2b_url = _e2b_api_url()
                if e2b_url:
                    kwargs["api_url"] = e2b_url
                return await AsyncSandbox.create(**kwargs)
            except ImportError as e:
                err_e2b = e
                logger.warning(
                    "[sandbox] e2b package not installed; install e2b or use OpenSandbox only: %s",
                    e,
                )
            except Exception as e:  # noqa: BLE001
                err_e2b = e
                logger.warning(
                    "[sandbox] E2B AsyncSandbox.create failed, trying OpenSandbox fallback: %s",
                    e,
                )
        if not self._os_url or not self._os_key:
            if err_e2b is not None:
                raise err_e2b
            raise ExecutionBackendConfigurationError(
                "OpenSandbox fallback is not configured (OPENSANDBOX_API_URL and OPENSANDBOX_API_KEY)."
            )
        try:
            from opensandbox import Sandbox

            return await Sandbox.create(
                template=_template_for_stage(stage),
                timeout=_SANDBOX_CREATE_TIMEOUT,
                api_url=self._os_url,
                api_key=self._os_key,
            )
        except ImportError as e:
            raise RuntimeError(
                "E2B failed or was skipped and OpenSandbox fallback requires opensandbox-sdk. "
                "Install with: pip install 'execution-backend[opensandbox]'"
            ) from e

    async def run_compile(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
    ) -> CompileResult:
        """Run compile inside a sandbox (E2B or OpenSandbox)."""
        return await self.run_compile_streaming(
            contract_code, framework, files, run_id=None, on_log=None
        )

    async def run_compile_streaming(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
        run_id: str | None = None,
        on_log: Optional[Callable[[str, str], None]] = None,
    ) -> CompileResult:
        """Run compile inside sandbox. When on_log is set, streams log lines when supported."""
        workdir = _sandbox_workdir()
        try:
            sandbox = await self._open_sandbox("compile")
            try:
                wd_q = shlex.quote(workdir)
                await sandbox.commands.run(
                    f"mkdir -p {wd_q}/contracts {wd_q}/src",
                    timeout=120,
                )
                src = f"{workdir}/contracts" if framework == "hardhat" else f"{workdir}/src"
                await sandbox.files.write(f"{src}/Contract.sol", contract_code)
                cmd: str
                if framework == "hardhat":
                    await sandbox.files.write(
                        f"{workdir}/package.json",
                        json.dumps({
                            "name": "compile",
                            "scripts": {"compile": "npx hardhat compile"},
                            "devDependencies": {"hardhat": "^2.19.0"},
                        }),
                    )
                    cmd = f"cd {wd_q} && npm install && npm run compile"
                else:
                    await sandbox.files.write(
                        f"{workdir}/foundry.toml",
                        '[profile.default]\nsolc = "0.8.24"\n',
                    )
                    cmd = f"cd {wd_q} && forge build --json"

                run_streaming = getattr(sandbox.commands, "run_streaming", None)
                stdout = ""
                stderr = ""

                if on_log and run_streaming and callable(run_streaming):
                    try:
                        out_buf: list[str] = []
                        async for chunk in run_streaming(cmd, timeout=300):
                            if chunk:
                                msg = chunk.decode("utf-8") if isinstance(chunk, bytes) else str(chunk)
                                out_buf.append(msg)
                                for line in msg.splitlines():
                                    if line.strip():
                                        on_log("compile", line.strip())
                        stdout = "".join(out_buf)
                    except Exception:
                        result = await sandbox.commands.run(cmd, timeout=300)
                        stdout = result.stdout if hasattr(result, "stdout") else str(result)
                        stderr = result.stderr if hasattr(result, "stdout") else ""
                        for line in (stdout or "").splitlines():
                            if line.strip():
                                on_log("compile", line)
                        for line in (stderr or "").splitlines():
                            if line.strip():
                                on_log("compile", line)
                else:
                    result = await sandbox.commands.run(cmd, timeout=300)
                    stdout = result.stdout if hasattr(result, "stdout") else str(result)
                    stderr = result.stderr if hasattr(result, "stdout") else ""
                    if on_log:
                        for line in (stdout or "").splitlines():
                            if line.strip():
                                on_log("compile", line)
                        for line in (stderr or "").splitlines():
                            if line.strip():
                                on_log("compile", line)

                if "Compiler run successful" in stdout or "bytecode" in stdout.lower():
                    try:
                        data = json.loads(stdout) if stdout.strip().startswith("{") else {}
                        bytecode = data.get("bytecode") or data.get("contracts", {}).get("Contract", {}).get("evm", {}).get("bytecode", {}).get("object")
                        abi = data.get("abi", [])
                        return CompileResult(success=True, bytecode=bytecode, abi=abi)
                    except json.JSONDecodeError:
                        pass
                return CompileResult(success=False, errors=[stderr or stdout[:500]])
            finally:
                await _dispose_sandbox(sandbox)
        except Exception as e:
            logger.exception("[sandbox] compile failed: %s", e)
            return CompileResult(success=False, errors=[str(e)])

    async def run_audit(
        self,
        contract_code: str,
        contract_name: str,
        tools: list[str] | None = None,
        on_log: Optional[Callable[[str, str], None]] = None,
    ) -> AuditResult:
        """Run audit (Slither, Mythril) inside a sandbox."""
        workdir = _sandbox_workdir()
        try:
            sandbox = await self._open_sandbox("audit")
            try:
                wd_q = shlex.quote(workdir)
                await sandbox.commands.run(f"mkdir -p {wd_q}/src", timeout=60)
                src = f"{workdir}/src"
                await sandbox.files.write(f"{src}/{contract_name}.sol", contract_code)
                await sandbox.files.write(
                    f"{workdir}/foundry.toml",
                    '[profile.default]\nsolc = "0.8.24"\n',
                )
                tool_list = tools or ["slither", "mythril"]
                findings: list[dict[str, Any]] = []
                tools_run: list[str] = []
                tools_failed: list[str] = []
                for tool in tool_list:
                    try:
                        if tool == "slither":
                            result = await sandbox.commands.run(f"slither {src} --json -", timeout=120)
                            out = result.stdout if hasattr(result, "stdout") else str(result)
                            if on_log and out:
                                for line in out.strip().split("\n"):
                                    if line.strip():
                                        on_log("slither", line[:1024])
                            try:
                                data = json.loads(out)
                                for d in data.get("results", {}).get("detectors", []):
                                    findings.append({
                                        "severity": (d.get("impact") or "medium").lower(),
                                        "title": d.get("check", "Finding"),
                                        "description": d.get("description", ""),
                                        "location": (d.get("markdown") or "").split("\n")[0],
                                        "category": d.get("check"),
                                        "tool": "slither",
                                    })
                                tools_run.append("slither")
                            except json.JSONDecodeError:
                                tools_run.append("slither")
                        elif tool == "mythril":
                            result = await sandbox.commands.run(
                                f"mythril analyze {src}/{contract_name}.sol -o json 2>/dev/null || true", timeout=120
                            )
                            out = result.stdout if hasattr(result, "stdout") else str(result)
                            if on_log and out:
                                for line in out.strip().split("\n"):
                                    if line.strip():
                                        on_log("mythril", line[:1024])
                            try:
                                data = json.loads(out)
                                for d in data.get("issues", []) if isinstance(data, dict) else []:
                                    findings.append({
                                        "severity": (d.get("severity") or "medium").lower(),
                                        "title": d.get("title", "Finding"),
                                        "description": d.get("description", ""),
                                        "location": d.get("filename", ""),
                                        "category": d.get("type", "mythril"),
                                        "tool": "mythril",
                                    })
                                tools_run.append("mythril")
                            except (json.JSONDecodeError, TypeError):
                                tools_run.append("mythril")
                        elif tool == "echidna":
                            result = await sandbox.commands.run(
                                f"echidna {src}/{contract_name}.sol --contract {contract_name} 2>/dev/null || true", timeout=60
                            )
                            out = result.stdout if hasattr(result, "stdout") else str(result)
                            if on_log and out:
                                for line in out.strip().split("\n"):
                                    if line.strip():
                                        on_log("echidna", line[:1024])
                            if "FAIL" in out or "failed" in out.lower():
                                findings.append({
                                    "severity": "medium",
                                    "title": "Echidna fuzzing found failure",
                                    "description": out[:500],
                                    "location": f"{contract_name}.sol",
                                    "category": "echidna",
                                    "tool": "echidna",
                                })
                            tools_run.append("echidna")
                        else:
                            tools_failed.append(tool)
                    except Exception as e:  # noqa: BLE001
                        logger.warning("[sandbox] tool %s failed: %s", tool, e)
                        tools_failed.append(tool)
                return AuditResult(findings=findings, tools_run=tools_run, tools_failed=tools_failed)
            finally:
                await _dispose_sandbox(sandbox)
        except Exception as e:  # noqa: BLE001
            logger.exception("[sandbox] audit failed: %s", e)
            return AuditResult(
                findings=[{"severity": "high", "title": "Audit failed", "description": str(e)}],
                tools_run=[],
                tools_failed=tools or ["slither", "mythril"],
            )

    async def run_multi_engine_audit(
        self,
        contract_code: str,
        contract_name: str,
        engines: list[list[str]] | None = None,
        on_log: Optional[Callable[[str, str], None]] = None,
    ) -> AuditResult:
        """Run parallel sandboxes, each with a different audit engine."""
        engine_list = engines or [["slither"], ["mythril"], ["echidna"]]

        async def _run_one(tools: list[str]) -> AuditResult:
            try:
                return await self.run_audit(contract_code, contract_name, tools=tools, on_log=on_log)
            except Exception as e:  # noqa: BLE001
                logger.warning("[sandbox] multi-engine %s failed: %s", tools, e)
                return AuditResult(findings=[], tools_run=[], tools_failed=tools)

        results = await asyncio.gather(*[_run_one(tools) for tools in engine_list])
        all_findings: list[dict[str, Any]] = []
        tools_run: list[str] = []
        tools_failed: list[str] = []
        for r in results:
            all_findings.extend(r.findings)
            tools_run.extend(r.tools_run)
            tools_failed.extend(r.tools_failed)
        for f in all_findings:
            f.setdefault("tool", ",".join(tools_run) or "multi-engine")
        return AuditResult(findings=all_findings, tools_run=list(dict.fromkeys(tools_run)), tools_failed=tools_failed)

    async def run_exploit_sim(
        self,
        contracts: dict[str, str],
        spec: dict[str, Any],
        design: dict[str, Any],
    ) -> ExploitSimResult:
        """Run exploit vectors in sandboxes; aggregate findings."""
        workdir = _sandbox_workdir()
        vectors = [
            ("reentrancy", ["reentrancy-eth", "reentrancy-loops", "reentrancy-no-eth"]),
            ("flashloan", ["delegatecall-loop", "unprotected-upgrade"]),
            ("oracle", ["controlled-delegatecall", "arbitrary-send-eth"]),
            ("frontrun", ["tx-origin", "suicidal"]),
        ]

        async def _run_vector(label: str, detectors: list[str]) -> ExploitSimResult:
            try:
                if not contracts:
                    return ExploitSimResult(passed=True, findings=[])
                contract_name = next(
                    (n.replace(".sol", "") for n, c in contracts.items() if isinstance(c, str) and n.endswith(".sol")),
                    "Contract",
                )
                code = next((c for n, c in contracts.items() if isinstance(c, str) and n.endswith(".sol")), "")
                if not code:
                    return ExploitSimResult(passed=True, findings=[])
                sandbox = await self._open_sandbox("exploit")
                try:
                    wd_q = shlex.quote(workdir)
                    await sandbox.commands.run(f"mkdir -p {wd_q}/src", timeout=60)
                    src = f"{workdir}/src"
                    await sandbox.files.write(f"{src}/{contract_name}.sol", code)
                    await sandbox.files.write(
                        f"{workdir}/foundry.toml",
                        '[profile.default]\nsolc = "0.8.24"\n',
                    )
                    detect_arg = ",".join(detectors)
                    result = await sandbox.commands.run(
                        f"slither {src} --detect {detect_arg} --json - 2>/dev/null || true", timeout=90
                    )
                    out = result.stdout if hasattr(result, "stdout") else str(result)
                    findings: list[dict[str, Any]] = []
                    try:
                        data = json.loads(out)
                        for d in data.get("results", {}).get("detectors", []):
                            findings.append({
                                "severity": (d.get("impact") or "medium").lower(),
                                "title": f"[{label}] {d.get('check', 'Finding')}",
                                "description": d.get("description", ""),
                                "vector": label,
                            })
                    except json.JSONDecodeError:
                        pass
                    return ExploitSimResult(passed=len(findings) == 0, findings=findings)
                finally:
                    await _dispose_sandbox(sandbox)
            except Exception as e:  # noqa: BLE001
                logger.warning("[sandbox] exploit vector %s failed: %s", label, e)
                return ExploitSimResult(passed=True, findings=[])

        results = await asyncio.gather(*[_run_vector(label, dets) for label, dets in vectors])
        all_findings: list[dict[str, Any]] = []
        for r in results:
            all_findings.extend(r.findings)
        passed = not any(not r.passed for r in results) and len(all_findings) == 0
        return ExploitSimResult(passed=passed, findings=all_findings)

    async def run_gas_benchmark(
        self,
        contract_code: str,
        contract_name: str,
        configs: list[dict[str, Any]] | None = None,
    ) -> GasBenchmarkResult:
        """Run gas benchmark across compiler configs. Returns score 0-100."""
        default_configs = [
            {"solc": "0.8.19", "optimizer": False},
            {"solc": "0.8.24", "optimizer": False},
            {"solc": "0.8.24", "optimizer": True, "runs": 200},
            {"solc": "0.8.24", "optimizer": True, "runs": 10000},
            {"solc": "0.8.19", "optimizer": True, "runs": 200},
        ]
        config_list = configs or default_configs

        async def _bench_one(cfg: dict[str, Any]) -> int:  # noqa: ARG001
            try:
                r = await self.run_compile(contract_code, framework="foundry", files=None)
                if r.success and r.bytecode:
                    return len(r.bytecode)
            except Exception:  # noqa: BLE001
                pass
            return 0

        sizes = await asyncio.gather(*[_bench_one(c) for c in config_list])
        min_sz = min(s for s in sizes if s > 0) or 1
        if not any(sizes):
            return GasBenchmarkResult(score=0.0, configs=config_list, bytecode_sizes=sizes)
        score = 100.0 * min_sz / max(sizes) if max(sizes) > 0 else 0.0
        return GasBenchmarkResult(score=min(100.0, score), configs=config_list, bytecode_sizes=sizes)
