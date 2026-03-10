"""
HyperAgent Compile Service
Compiles Solidity via Hardhat, Foundry, or py-solc-x (lite mode).
When TOOLS_BASE_URL is set, proxies to remote hyperagent-tools service.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")
TOOLS_API_KEY = os.environ.get("TOOLS_API_KEY", "")

app = FastAPI(title="HyperAgent Compile Service", version="0.1.0")

_MD_FENCE_RE = re.compile(r"^```(?:solidity|sol)?\s*\n?", re.MULTILINE)
_MD_FENCE_END_RE = re.compile(r"\n?```\s*$", re.MULTILINE)


def _strip_markdown_fences(source: str) -> str:
    """Remove markdown code fences that LLMs wrap around Solidity output."""
    s = _MD_FENCE_RE.sub("", source)
    s = _MD_FENCE_END_RE.sub("", s)
    return s.strip()

# Safe filename: basename only, [a-zA-Z0-9_.-]+\\.sol (path traversal prevention)
_SAFE_SOL_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+\.sol$")


def _safe_sol_filename(name: str) -> str:
    """Return a safe .sol filename for use in temp dirs. Reject path traversal and invalid names."""
    if not name or not isinstance(name, str):
        raise HTTPException(status_code=400, detail="Invalid filename")
    base = Path(name).name
    if ".." in name or os.sep in name or (os.altsep and os.altsep in name):
        raise HTTPException(status_code=400, detail="Filename must not contain path components")
    if not _SAFE_SOL_PATTERN.match(base):
        raise HTTPException(status_code=400, detail="Filename must match [a-zA-Z0-9_.-]+.sol")
    return base


class CompileRequest(BaseModel):
    contractCode: str = Field("", description="Solidity source code (optional when files provided)", alias="contractCode")
    framework: str = Field(..., description="hardhat or foundry")
    files: dict[str, str] | None = Field(None, description="Multi-file: filename -> source for interdependent contracts")
    entryContract: str | None = Field(None, description="Contract name to return bytecode/abi for when using files")

    model_config = {"populate_by_name": True}


class CompileErrorItem(BaseModel):
    message: str
    sourceLocation: str | None = None


class CompileResponse(BaseModel):
    success: bool
    bytecode: str | None = None
    abi: list | None = None
    errors: list[str] | list[CompileErrorItem] = Field(default_factory=list)
    compilerVersion: str | None = None
    contractName: str | None = None


def _extract_contract_name(source: str) -> str:
    """Extract first contract name from Solidity source. Handles inheritance (is X, Y)."""
    match = re.search(r"contract\s+(\w+)[^{]*\{", source)
    raw = match.group(1) if match else "Contract"
    if not re.match(r"^[a-zA-Z0-9_]+$", raw):
        return "Contract"
    return raw


COMPILE_MODE = (os.environ.get("COMPILE_MODE") or "full").strip().lower()
USE_SOLC_LITE = COMPILE_MODE == "lite"


def _compile_solcx(contract_name: str, contract_code: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile using py-solc-x (solc only). Single-file, no OpenZeppelin imports."""
    try:
        import solcx
    except ImportError:
        return False, None, None, ["py-solc-x not installed; set COMPILE_MODE=full or pip install py-solc-x"]
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
            bytecode = data.get("bin") or (data.get("bytecode", {}).get("object") if isinstance(data.get("bytecode"), dict) else None)
            abi = data.get("abi", [])
            return True, bytecode, abi, []
    return False, None, None, ["Contract not found in compiled output"]


def _compile_foundry_multi(workdir: Path, files: dict[str, str], entry_contract: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile multiple interdependent files with Foundry. Returns artifact for entry_contract."""
    src = workdir / "src"
    src.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        safe = _safe_sol_filename(name)
        path = src / safe
        code = _strip_markdown_fences(content)
        if "pragma solidity" not in code.strip().lower():
            code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
        path.write_text(code, encoding="utf-8")
    (workdir / "foundry.toml").write_text("[profile.default]\nsolc = \"0.8.24\"\n")
    try:
        result = subprocess.run(["forge", "build", "--json"], cwd=workdir, capture_output=True, text=True, timeout=90)
    except FileNotFoundError:
        return False, None, None, ["Foundry (forge) not installed or not in PATH"]
    if result.returncode != 0:
        return False, None, None, [result.stderr or result.stdout or "forge build failed"]
    for name in files:
        # Use the same safe filename logic as when writing sources, to avoid
        # uncontrolled paths derived from untrusted `name` and to match Foundry's output.
        safe_name = _safe_sol_filename(name)
        base = Path(safe_name).stem
        out_dir = workdir / "out" / f"{base}.sol"
        if out_dir.exists():
            artifact = out_dir / f"{base}.json"
            if artifact.exists() and base == entry_contract:
                data = json.loads(artifact.read_text())
                bc = data.get("bytecode", {}) if isinstance(data.get("bytecode"), dict) else data.get("bytecode")
                bytecode = bc.get("object") if isinstance(bc, dict) else bc
                if isinstance(bytecode, dict):
                    bytecode = bytecode.get("object")
                return True, bytecode, data.get("abi", []), []
    return False, None, None, [f"Contract {entry_contract} not found in compiled output"]


def _compile_foundry_impl(workdir: Path, contract_name: str, contract_code: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile using Foundry (forge build)."""
    src = workdir / "src"
    src.mkdir(parents=True, exist_ok=True)
    if "pragma solidity" not in contract_code.strip().lower():
        contract_code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + contract_code
    (src / f"{contract_name}.sol").write_text(contract_code)
    (workdir / "foundry.toml").write_text("[profile.default]\nsolc = \"0.8.24\"\n")
    try:
        result = subprocess.run(
            ["forge", "build", "--json"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        return False, None, None, ["Foundry (forge) not installed or not in PATH"]
    if result.returncode != 0:
        return False, None, None, [result.stderr or result.stdout or "forge build failed"]
    out_dir = workdir / "out" / f"{contract_name}.sol"
    if not out_dir.exists():
        return False, None, None, ["No output artifact; check contract name"]
    artifact = out_dir / f"{contract_name}.json"
    if not artifact.exists():
        return False, None, None, ["Artifact JSON not found"]
    data = json.loads(artifact.read_text())
    bc = data.get("bytecode", {}) if isinstance(data.get("bytecode"), dict) else {}
    bytecode = bc.get("object") or data.get("bytecode")
    if isinstance(bytecode, dict):
        bytecode = bytecode.get("object")
    abi = data.get("abi", [])
    return True, bytecode, abi, []


_HARDHAT_TEMPLATE = Path("/opt/hardhat-template")


def _compile_hardhat_multi(workdir: Path, files: dict[str, str], entry_contract: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile multiple interdependent files with Hardhat. Returns artifact for entry_contract."""
    contracts_dir = workdir / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        safe = _safe_sol_filename(name)
        code = _strip_markdown_fences(content)
        if "pragma solidity" not in code.strip().lower():
            code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
        (contracts_dir / safe).write_text(code, encoding="utf-8")
    (workdir / "hardhat.config.js").write_text(
        """module.exports = { solidity: "0.8.24", paths: { sources: "./contracts" } };\n"""
    )
    template_nm = _HARDHAT_TEMPLATE / "node_modules"
    if template_nm.exists() and not (workdir / "node_modules").exists():
        os.symlink(str(template_nm), str(workdir / "node_modules"))
    template_pkg = _HARDHAT_TEMPLATE / "package.json"
    if template_pkg.exists() and not (workdir / "package.json").exists():
        shutil.copy2(str(template_pkg), str(workdir / "package.json"))
    try:
        result = subprocess.run(
            ["npx", "hardhat", "compile", "--force"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        return False, None, None, ["Node/npx not installed or not in PATH"]
    if result.returncode != 0:
        return False, None, None, [result.stderr or result.stdout or "hardhat compile failed"]
    artifact_path = workdir / "artifacts" / "contracts" / f"{entry_contract}.sol" / f"{entry_contract}.json"
    if not artifact_path.exists():
        return False, None, None, [f"Contract {entry_contract} not found in compiled output"]
    data = json.loads(artifact_path.read_text())
    bytecode = data.get("bytecode") or (data.get("deployedBytecode", {}).get("object") if isinstance(data.get("deployedBytecode"), dict) else None)
    if isinstance(bytecode, dict):
        bytecode = bytecode.get("object")
    return True, bytecode, data.get("abi", []), []


def _compile_hardhat(workdir: Path, contract_name: str, contract_code: str) -> tuple[bool, str | None, list | None, list[str]]:
    """Compile using Hardhat (npx hardhat compile). Uses pre-built template for local node_modules."""
    contracts_dir = workdir / "contracts"
    contracts_dir.mkdir(parents=True, exist_ok=True)
    if "pragma solidity" not in contract_code.strip().lower():
        contract_code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + contract_code
    (contracts_dir / f"{contract_name}.sol").write_text(contract_code)
    (workdir / "hardhat.config.js").write_text(
        """module.exports = { solidity: "0.8.24", paths: { sources: "./contracts" } };\n"""
    )
    # Symlink pre-built node_modules + package.json for fast local install
    template_nm = _HARDHAT_TEMPLATE / "node_modules"
    if template_nm.exists() and not (workdir / "node_modules").exists():
        os.symlink(str(template_nm), str(workdir / "node_modules"))
    template_pkg = _HARDHAT_TEMPLATE / "package.json"
    if template_pkg.exists() and not (workdir / "package.json").exists():
        shutil.copy2(str(template_pkg), str(workdir / "package.json"))
    try:
        result = subprocess.run(
            ["npx", "hardhat", "compile", "--force"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=90,
        )
    except FileNotFoundError:
        return False, None, None, ["Node/npx not installed or not in PATH"]
    if result.returncode != 0:
        return False, None, None, [result.stderr or result.stdout or "hardhat compile failed"]
    artifact_path = workdir / "artifacts" / "contracts" / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.exists():
        return False, None, None, ["Artifact not found after compile"]
    data = json.loads(artifact_path.read_text())
    bytecode = data.get("bytecode") or (data.get("deployedBytecode", {}).get("object") if isinstance(data.get("deployedBytecode"), dict) else None)
    if isinstance(bytecode, dict):
        bytecode = bytecode.get("object")
    abi = data.get("abi", [])
    return True, bytecode, abi, []


def _normalize_errors(errors: list[str]) -> list[CompileErrorItem]:
    return [CompileErrorItem(message=e, sourceLocation=None) for e in errors]


def _compile_via_tools(req: CompileRequest, code: str, contract_name: str) -> CompileResponse | None:
    """When TOOLS_BASE_URL is set, call remote hyperagent-tools and map response."""
    if not TOOLS_BASE_URL:
        return None
    toolchain = "foundry" if req.framework == "foundry" else "hardhat"
    src_dir = "src" if toolchain == "foundry" else "contracts"
    files: dict[str, str] = {}
    if req.files:
        for name, content in req.files.items():
            if isinstance(content, str):
                files[name] = content
    if not files:
        files[f"{src_dir}/{contract_name}.sol"] = code
    entry = f"{src_dir}/{contract_name}.sol:{contract_name}"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if TOOLS_API_KEY:
        headers["X-TOOLS-API-KEY"] = TOOLS_API_KEY
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                f"{TOOLS_BASE_URL}/compile",
                headers=headers,
                json={
                    "toolchain": toolchain,
                    "solcVersion": "0.8.24",
                    "files": files,
                    "entry": entry,
                },
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        return CompileResponse(
            success=False,
            errors=[str(e)],
            compilerVersion="0.8.24",
            contractName=contract_name,
        )
    artifacts = data.get("artifacts") or {}
    return CompileResponse(
        success=data.get("success", True),
        bytecode=artifacts.get("bytecode"),
        abi=artifacts.get("abi") or [],
        errors=_normalize_errors(data.get("errors") or []),
        compilerVersion="0.8.24",
        contractName=artifacts.get("contractName") or contract_name,
    )


@app.post("/compile")
def compile_contract(req: CompileRequest) -> CompileResponse:
    if req.framework not in ("hardhat", "foundry"):
        raise HTTPException(status_code=400, detail="framework must be 'hardhat' or 'foundry'")
    code = _strip_markdown_fences(req.contractCode or "")
    files = req.files or {}
    entry_contract = req.entryContract

    if len(files) > 1:
        entry_contract = entry_contract or next((Path(n).stem for n in files if n.endswith(".sol")), None)
        if not entry_contract:
            raise HTTPException(status_code=400, detail="entryContract required when compiling multiple files")
        contract_name = entry_contract
    else:
        contract_name = entry_contract or _extract_contract_name(code or next(iter(files.values()), ""))

    remote = _compile_via_tools(req, code or next(iter(files.values()), ""), contract_name)
    if remote is not None:
        return remote

    if USE_SOLC_LITE and len(files) <= 1:
        code_for_lite = code or next(iter(files.values()), "")
        success, bytecode, abi, errors = _compile_solcx(contract_name, code_for_lite)
        return CompileResponse(
            success=success,
            bytecode=bytecode,
            abi=abi,
            errors=_normalize_errors(errors),
            compilerVersion="0.8.24",
            contractName=contract_name,
        )

    workdir = Path(tempfile.mkdtemp(prefix="compile_"))
    try:
        if len(files) > 1:
            if req.framework == "foundry":
                success, bytecode, abi, errors = _compile_foundry_multi(workdir, files, entry_contract)
            else:
                success, bytecode, abi, errors = _compile_hardhat_multi(workdir, files, entry_contract)
        else:
            code_single = code or next(iter(files.values()), "")
            if req.files:
                src = workdir / "src" if req.framework == "foundry" else workdir / "contracts"
                src.mkdir(parents=True, exist_ok=True)
                for name, content in req.files.items():
                    if isinstance(content, str):
                        safe_name = _safe_sol_filename(name)
                        (src / safe_name).write_text(content, encoding="utf-8")
            if req.framework == "foundry":
                success, bytecode, abi, errors = _compile_foundry_impl(workdir, contract_name, code_single)
            else:
                success, bytecode, abi, errors = _compile_hardhat(workdir, contract_name, code_single)
        return CompileResponse(
            success=success,
            bytecode=bytecode,
            abi=abi,
            errors=_normalize_errors(errors),
            compilerVersion="0.8.24",
            contractName=contract_name,
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


@app.get("/health")
def health():
    return {"status": "ok"}
