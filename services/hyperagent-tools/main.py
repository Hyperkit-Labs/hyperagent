"""
HyperAgent Tools Service
Unified compile and audit API. Compile via py-solc-x; audit via Slither.
"""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="HyperAgent Tools Service", version="0.1.0")

TOOLS_API_KEY = os.environ.get("TOOLS_API_KEY")


def _require_api_key(x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY")) -> None:
    """When TOOLS_API_KEY is set, require X-TOOLS-API-KEY header on requests."""
    if TOOLS_API_KEY and x_tools_api_key != TOOLS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-TOOLS-API-KEY")


class CompileRequest(BaseModel):
    toolchain: str = Field(..., description="hardhat or foundry")
    files: dict[str, str] = Field(..., description="filename -> source content")
    entry: str = Field(..., description="entry contract/file name")
    solcVersion: str | None = Field(None, description="Solidity version, e.g. 0.8.24")


class CompileArtifacts(BaseModel):
    abi: list = Field(default_factory=list)
    bytecode: str = "0x"
    contractName: str = ""


class CompileResponse(BaseModel):
    success: bool = True
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    artifacts: CompileArtifacts = Field(default_factory=lambda: CompileArtifacts())
    logs: str = ""


_MD_FENCE_RE = re.compile(r"^```(?:solidity|sol)?\s*\n?", re.MULTILINE)
_MD_FENCE_END_RE = re.compile(r"\n?```\s*$", re.MULTILINE)
_SAFE_SOL_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+\.sol$")


def _safe_sol_filename(name: str) -> str:
    """Return a safe .sol basename for path construction. Reject path traversal."""
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Invalid filename")
    base = Path(name).name
    if ".." in name or name.startswith("/") or (os.sep in name) or (os.altsep and os.altsep in name):
        raise HTTPException(status_code=400, detail="Filename must not contain path traversal")
    if not _SAFE_SOL_PATTERN.match(base):
        raise HTTPException(status_code=400, detail="Filename must match [a-zA-Z0-9_.-]+.sol")
    return base


def _strip_markdown_fences(source: str) -> str:
    """Remove markdown code fences that LLMs wrap around Solidity output."""
    s = _MD_FENCE_RE.sub("", source)
    s = _MD_FENCE_END_RE.sub("", s)
    return s.strip()


def _extract_contract_name(source: str) -> str:
    """Extract first contract name from Solidity source."""
    match = re.search(r"contract\s+(\w+)[^{]*\{", source)
    raw = match.group(1) if match else "Contract"
    if not re.match(r"^[a-zA-Z0-9_]+$", raw):
        return "Contract"
    return raw


def _compile_solcx(contract_name: str, contract_code: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile using py-solc-x. Single-file, no external imports."""
    try:
        import solcx
    except ImportError:
        return False, None, None, ["py-solc-x not installed"]
    try:
        solcx.install_solc("0.8.24")
    except Exception as e:
        return False, None, None, [f"solc install failed: {e}"]
    if "pragma solidity" not in contract_code.strip().lower():
        contract_code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + contract_code
    try:
        compiled = solcx.compile_source(
            contract_code,
            output_values=["abi", "bin"],
            solc_version="0.8.24",
        )
    except Exception as e:
        return False, None, None, [str(e)]
    for key, data in compiled.items():
        if contract_name in key:
            bytecode = data.get("bin") or (
                data.get("bytecode", {}).get("object") if isinstance(data.get("bytecode"), dict) else None
            )
            abi = data.get("abi", [])
            if bytecode and not bytecode.startswith("0x"):
                bytecode = "0x" + bytecode
            return True, bytecode, abi, []
    return False, None, None, ["Contract not found in compiled output"]


def _run_slither(workdir: Path, files: dict[str, str], entry: str) -> list[dict]:
    """Run Slither on contract files. Returns list of {severity, title, description, location, category}."""
    contracts_dir = workdir / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    for path, content in files.items():
        safe = _safe_sol_filename(path)
        dst = contracts_dir / safe
        code = content.strip()
        if "pragma solidity" not in code.lower():
            code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
        dst.write_text(code)
    (workdir / "foundry.toml").write_text('[profile.default]\nsolc = "0.8.24"\n')
    target = workdir / "contracts" if (workdir / "contracts").exists() else workdir
    if not any(target.rglob("*.sol")):
        target = workdir
    try:
        result = subprocess.run(
            ["slither", str(target), "--json", "-"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        return [{"severity": "info", "title": "Slither not installed", "description": "Install: pip install slither-analyzer", "location": None, "category": None}]
    out: list[dict] = []
    if result.stdout:
        try:
            data = json.loads(result.stdout)
            for d in data.get("results", {}).get("detectors", []):
                loc = None
                if d.get("markdown"):
                    loc = d.get("markdown", "").split("\n")[0]
                elif d.get("elements"):
                    el = d["elements"][0] if isinstance(d["elements"], list) else None
                    if isinstance(el, dict) and el.get("source_mapping"):
                        loc = str(el.get("source_mapping", {}).get("filename_short", ""))
                out.append({
                    "severity": (d.get("impact") or "unknown").lower() if isinstance(d.get("impact"), str) else "medium",
                    "title": d.get("check", "Finding"),
                    "description": d.get("description", ""),
                    "location": loc,
                    "category": d.get("check"),
                })
        except json.JSONDecodeError:
            out.append({"severity": "high", "title": "Slither failed", "description": (result.stderr or result.stdout[:500]) or "Unknown error", "location": None, "category": None})
    return out


class AuditRequest(BaseModel):
    tool: str = Field(..., description="slither or mythril")
    files: dict[str, str] = Field(..., description="filename -> source content")
    entry: str = Field(..., description="entry contract/file name")
    solcVersion: str | None = Field(None, description="Solidity version")


class AuditArtifacts(BaseModel):
    issues: list = Field(default_factory=list)


class AuditResponse(BaseModel):
    success: bool = True
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    artifacts: AuditArtifacts = Field(default_factory=lambda: AuditArtifacts())
    logs: str = ""


@app.post("/compile", response_model=CompileResponse)
def compile_contract(
    req: CompileRequest,
    x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY"),
) -> CompileResponse:
    _require_api_key(x_tools_api_key)
    entry_path = req.entry.split(":")[0] if ":" in req.entry else req.entry.replace(".sol", ".sol")
    contract_name = req.entry.split(":")[-1] if ":" in req.entry else req.entry.replace(".sol", "").split("/")[-1]
    source = req.files.get(entry_path) or req.files.get(req.entry) or next(iter(req.files.values()), "")
    if not source:
        return CompileResponse(
            success=False,
            errors=[f"Entry file not found: {entry_path}"],
            artifacts=CompileArtifacts(contractName=contract_name),
        )
    source = _strip_markdown_fences(source)
    if not contract_name or contract_name == "sol":
        contract_name = _extract_contract_name(source)
    success, bytecode, abi, errors = _compile_solcx(contract_name, source)
    if not success:
        return CompileResponse(
            success=False,
            errors=errors,
            artifacts=CompileArtifacts(contractName=contract_name),
        )
    return CompileResponse(
        success=True,
        artifacts=CompileArtifacts(
            abi=abi or [],
            bytecode=bytecode or "0x",
            contractName=contract_name,
        ),
    )


@app.post("/audit", response_model=AuditResponse)
def audit_contract(
    req: AuditRequest,
    x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY"),
) -> AuditResponse:
    _require_api_key(x_tools_api_key)
    if req.tool == "mythril":
        return AuditResponse(
            success=True,
            artifacts=AuditArtifacts(issues=[{"severity": "info", "title": "Mythril", "description": "Mythril not available in hyperagent-tools; use Slither or run audit service locally.", "location": None, "category": None}]),
        )
    if req.tool != "slither":
        return AuditResponse(success=True, artifacts=AuditArtifacts(issues=[]))
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        issues = _run_slither(Path(tmp), req.files, req.entry)
    return AuditResponse(success=True, artifacts=AuditArtifacts(issues=issues))


@app.get("/health")
def health() -> dict:
    """Health check; no API key required for load balancers."""
    return {"status": "ok"}
