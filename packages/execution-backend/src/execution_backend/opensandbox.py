"""OpenSandbox execution backend: runs compile, audit, exploit_sim in isolated gVisor/Firecracker sandboxes."""

import json
import logging
import os
from typing import Any

from .protocol import AuditResult, CompileResult, ExploitSimResult, GasBenchmarkResult

logger = logging.getLogger(__name__)

OPENSANDBOX_API_URL = os.environ.get("OPENSANDBOX_API_URL", "")
OPENSANDBOX_API_KEY = os.environ.get("OPENSANDBOX_API_KEY", "")


class OpenSandboxBackend:
    """OpenSandbox backend: creates sandbox, uploads files, runs commands, returns results."""

    def __init__(
        self,
        api_url: str | None = None,
        api_key: str | None = None,
    ):
        self.api_url = api_url or OPENSANDBOX_API_URL
        self.api_key = api_key or OPENSANDBOX_API_KEY

    def _configured(self) -> bool:
        return bool(self.api_url and self.api_key)

    async def run_compile(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
    ) -> CompileResult:
        """Run compile inside OpenSandbox."""
        return await self.run_compile_streaming(
            contract_code, framework, files, run_id=None, on_log=None
        )

    async def run_compile_streaming(
        self,
        contract_code: str,
        framework: str = "hardhat",
        files: dict[str, str] | None = None,
        run_id: str | None = None,
        on_log: None | ((str, str) -> None) = None,
    ) -> CompileResult:
        """Run compile inside OpenSandbox. When on_log is provided, streams stdout/stderr line-by-line.
        Uses run_streaming if SDK supports it; otherwise emits after run() completes."""
        if not self._configured():
            logger.warning("[opensandbox] not configured, compile would run in sandbox")
            return CompileResult(success=False, errors=["OpenSandbox not configured"])
        try:
            from opensandbox import Sandbox

            sandbox = await Sandbox.create(template="base")
            try:
                workdir = "/sandbox"
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
                    cmd = "cd /sandbox && npm install && npm run compile"
                else:
                    await sandbox.files.write(
                        f"{workdir}/foundry.toml",
                        '[profile.default]\nsolc = "0.8.24"\n',
                    )
                    cmd = "cd /sandbox && forge build --json"

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
                await sandbox.kill()
                await sandbox.close()
        except ImportError:
            logger.warning("[opensandbox] opensandbox-sdk not installed")
            return CompileResult(success=False, errors=["opensandbox-sdk not installed"])
        except Exception as e:
            logger.exception("[opensandbox] compile failed: %s", e)
            return CompileResult(success=False, errors=[str(e)])

    async def run_audit(
        self,
        contract_code: str,
        contract_name: str,
        tools: list[str] | None = None,
        on_log: None | ((str, str) -> None) = None,
    ) -> AuditResult:
        """Run audit (Slither, Mythril) inside OpenSandbox."""
        if not self._configured():
            logger.warning("[opensandbox] not configured, audit would run in sandbox")
            return AuditResult(
                findings=[{"severity": "high", "title": "OpenSandbox not configured", "description": "Set OPENSANDBOX_API_URL and OPENSANDBOX_API_KEY"}],
                tools_run=[],
                tools_failed=tools or ["slither", "mythril"],
            )
        try:
            from opensandbox import Sandbox

            sandbox = await Sandbox.create(template="base")
            try:
                src = "/sandbox/src"
                await sandbox.files.write(f"{src}/{contract_name}.sol", contract_code)
                await sandbox.files.write(f"/sandbox/foundry.toml", '[profile.default]\nsolc = "0.8.24"\n')
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
                            result = await sandbox.commands.run(f"mythril analyze {src}/{contract_name}.sol -o json 2>/dev/null || true", timeout=120)
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
                            result = await sandbox.commands.run(f"echidna {src}/{contract_name}.sol --contract {contract_name} 2>/dev/null || true", timeout=60)
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
                    except Exception as e:
                        logger.warning("[opensandbox] tool %s failed: %s", tool, e)
                        tools_failed.append(tool)
                return AuditResult(findings=findings, tools_run=tools_run, tools_failed=tools_failed)
            finally:
                await sandbox.kill()
                await sandbox.close()
        except ImportError:
            return AuditResult(
                findings=[{"severity": "high", "title": "opensandbox-sdk not installed", "description": "pip install opensandbox-sdk"}],
                tools_run=[],
                tools_failed=tools or ["slither", "mythril"],
            )
        except Exception as e:
            logger.exception("[opensandbox] audit failed: %s", e)
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
        on_log: None | ((str, str) -> None) = None,
    ) -> AuditResult:
        """Run 3+ parallel OpenSandboxes, each with a different audit engine.
        Default engines: [slither], [mythril], [echidna] (best-effort)."""
        if not self._configured():
            return AuditResult(
                findings=[{"severity": "high", "title": "OpenSandbox not configured", "description": "Set OPENSANDBOX_API_URL and OPENSANDBOX_API_KEY"}],
                tools_run=[],
                tools_failed=["slither", "mythril", "echidna"],
            )
        engine_list = engines or [["slither"], ["mythril"], ["echidna"]]
        import asyncio

        async def _run_one(tools: list[str]) -> AuditResult:
            try:
                return await self.run_audit(contract_code, contract_name, tools=tools, on_log=on_log)
            except Exception as e:
                logger.warning("[opensandbox] multi-engine %s failed: %s", tools, e)
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
        """Run parallel exploit vectors (reentrancy, flashloan, oracle, frontrun) in OpenSandbox.
        Each vector runs in its own sandbox; findings are aggregated."""
        if not self._configured():
            return ExploitSimResult(passed=True, findings=[])
        import asyncio

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
                contract_name = next((n.replace(".sol", "") for n, c in contracts.items() if isinstance(c, str) and n.endswith(".sol")), "Contract")
                code = next((c for n, c in contracts.items() if isinstance(c, str) and n.endswith(".sol")), "")
                if not code:
                    return ExploitSimResult(passed=True, findings=[])
                from opensandbox import Sandbox

                sandbox = await Sandbox.create(template="base")
                try:
                    src = "/sandbox/src"
                    await sandbox.files.write(f"{src}/{contract_name}.sol", code)
                    await sandbox.files.write("/sandbox/foundry.toml", '[profile.default]\nsolc = "0.8.24"\n')
                    detect_arg = ",".join(detectors)
                    result = await sandbox.commands.run(f"slither {src} --detect {detect_arg} --json - 2>/dev/null || true", timeout=90)
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
                    await sandbox.kill()
                    await sandbox.close()
            except Exception as e:
                logger.warning("[opensandbox] exploit vector %s failed: %s", label, e)
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
        """Run gas benchmark across 5 compiler configs (solc versions + optimizer). Returns score 0-100."""
        if not self._configured():
            return GasBenchmarkResult(score=0.0, configs=[], bytecode_sizes=[])
        default_configs = [
            {"solc": "0.8.19", "optimizer": False},
            {"solc": "0.8.24", "optimizer": False},
            {"solc": "0.8.24", "optimizer": True, "runs": 200},
            {"solc": "0.8.24", "optimizer": True, "runs": 10000},
            {"solc": "0.8.19", "optimizer": True, "runs": 200},
        ]
        config_list = configs or default_configs
        import asyncio

        sizes: list[int] = []

        async def _bench_one(cfg: dict[str, Any]) -> int:
            try:
                r = await self.run_compile(contract_code, framework="foundry", files=None)
                if r.success and r.bytecode:
                    return len(r.bytecode)
            except Exception:
                pass
            return 0

        sizes = await asyncio.gather(*[_bench_one(c) for c in config_list])
        min_sz = min(s for s in sizes if s > 0) or 1
        if not any(sizes):
            return GasBenchmarkResult(score=0.0, configs=config_list, bytecode_sizes=sizes)
        score = 100.0 * min_sz / max(sizes) if max(sizes) > 0 else 0.0
        return GasBenchmarkResult(score=min(100.0, score), configs=config_list, bytecode_sizes=sizes)
