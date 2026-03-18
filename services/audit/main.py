"""
HyperAgent Audit Service
Slither, Mythril, MythX, Echidna. When TOOLS_BASE_URL is set, proxies to remote hyperagent-tools.
"""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

try:
    from contract_validation import safe_contract_name as _safe_contract_name_pkg
    from contract_validation import ValidationError
except ImportError:
    _safe_contract_name_pkg = None
    ValidationError = Exception  # type: ignore[misc, assignment]

TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")
TOOLS_API_KEY = os.environ.get("TOOLS_API_KEY", "")

app = FastAPI(title="HyperAgent Audit Service", version="0.1.0")


@app.middleware("http")
async def otel_request_span(request: Request, call_next):
    """Create OTel request span when OPENTELEMETRY_ENABLED."""
    rid = (request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or "").strip() or None
    try:
        from otel_spans import request_span
        with request_span(method=request.method or "GET", path=request.url.path or "/", request_id=rid):
            return await call_next(request)
    except ImportError:
        return await call_next(request)


def _safe_contract_name(contract_name: str) -> str:
    """Return a safe contract name for file paths. Uses contract_validation package when available."""
    if _safe_contract_name_pkg:
        try:
            return _safe_contract_name_pkg(contract_name)
        except ValidationError as e:
            raise HTTPException(status_code=getattr(e, "status_code", 400), detail=e.detail) from e
    # Fallback when package not installed
    if not contract_name or not isinstance(contract_name, str):
        raise HTTPException(status_code=400, detail="Invalid contract name")
    base = Path(contract_name).name
    if ".." in contract_name or "/" in contract_name or "\\" in contract_name:
        raise HTTPException(status_code=400, detail="Contract name must not contain path components")
    if not re.match(r"^[a-zA-Z0-9_]+$", base):
        raise HTTPException(status_code=400, detail="Contract name must be alphanumeric with optional underscores")
    return base


class AuditRequest(BaseModel):
    contractCode: str = Field(..., alias="contractCode")
    contractName: str = Field(..., alias="contractName")

    model_config = {"populate_by_name": True}


class Finding(BaseModel):
    severity: str
    title: str
    description: str
    location: str | None = None
    category: str | None = None


class AuditResponse(BaseModel):
    findings: list[Finding] = Field(default_factory=list)
    tools_run: list[str] = Field(default_factory=list)
    tools_failed: list[str] = Field(default_factory=list)


EXPLOIT_DETECTORS = "reentrancy,reentrancy-eth,reentrancy-no-eth,reentrancy-benign,unchecked-transfer,unchecked-lowlevel"


def _run_slither(workdir: Path, contract_name: str, code: str) -> list[dict]:
    return _run_slither_impl(workdir, contract_name, code, detectors=None)


def _run_slither_exploit(workdir: Path, contract_name: str, code: str) -> list[dict]:
    """Run Slither with exploit-focused detectors only."""
    return _run_slither_impl(workdir, contract_name, code, detectors=EXPLOIT_DETECTORS)


def _run_slither_impl(workdir: Path, contract_name: str, code: str, detectors: str | None = None) -> list[dict]:
    src = workdir / "src"
    src.mkdir(parents=True, exist_ok=True)
    if "pragma solidity" not in code.strip().lower():
        code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
    (src / f"{contract_name}.sol").write_text(code)
    (workdir / "foundry.toml").write_text('[profile.default]\nsolc = "0.8.24"\n')
    cmd = ["slither", str(src), "--json", "-"]
    if detectors:
        cmd.extend(["--detect", detectors])
    try:
        result = subprocess.run(
            cmd,
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        return [{"severity": "info", "title": "Slither not installed", "description": "Install: pip install slither-analyzer", "location": None}]
    out: list[dict] = []
    if result.returncode != 0 and result.stdout:
        try:
            data = json.loads(result.stdout)
            for d in data.get("results", {}).get("detectors", []):
                out.append({
                    "severity": d.get("impact", "unknown").lower() if isinstance(d.get("impact"), str) else "medium",
                    "title": d.get("check", "Finding"),
                    "description": d.get("description", ""),
                    "location": d.get("markdown", "").split("\n")[0] if d.get("markdown") else None,
                    "category": d.get("check"),
                })
        except json.JSONDecodeError:
            out.append({"severity": "high", "title": "Slither failed", "description": result.stderr or result.stdout[:500], "location": None})
    return out


def _run_mythril(workdir: Path, contract_name: str, code: str) -> list[dict]:
    src = workdir / "src"
    src.mkdir(parents=True, exist_ok=True)
    if "pragma solidity" not in code.strip().lower():
        code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
    (src / f"{contract_name}.sol").write_text(code)
    try:
        result = subprocess.run(
            ["myth", "analyze", str(src / f"{contract_name}.sol"), "-o", "json"],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except FileNotFoundError:
        return [{"severity": "info", "title": "Mythril not installed", "description": "Install mythril-classic", "location": None}]
    out: list[dict] = []
    if result.stdout:
        try:
            data = json.loads(result.stdout)
            for issue in data.get("issues", []):
                out.append({
                    "severity": (issue.get("severity") or "medium").lower(),
                    "title": issue.get("title", "Finding"),
                    "description": issue.get("description", ""),
                    "location": issue.get("filename"),
                    "category": issue.get("title"),
                })
        except json.JSONDecodeError:
            pass
    return out


def _run_mythx(workdir: Path, contract_name: str, code: str) -> list[dict]:
    """MythX cloud API. Set MYTHX_API_KEY for real analysis. See https://docs.mythx.io."""
    import os
    import time
    key = os.environ.get("MYTHX_API_KEY")
    if not key:
        return [{"severity": "info", "title": "MythX", "description": "MythX requires MYTHX_API_KEY for cloud analysis.", "location": None}]
    try:
        import httpx
        with httpx.Client(timeout=30.0) as client:
            r = client.post(
                "https://api.mythx.io/v1/analyses",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "data": {
                        "sourceList": [{"source": code}],
                        "mainSource": f"{contract_name}.sol",
                    },
                    "analysisMode": "quick",
                },
            )
            if r.status_code not in (200, 201):
                return [{"severity": "info", "title": "MythX", "description": f"MythX API error: {r.status_code}", "location": None}]
            data = r.json()
            uuid = data.get("uuid") or data.get("id") or (data.get("data") or {}).get("uuid")
            if not uuid:
                return [{"severity": "info", "title": "MythX", "description": "MythX returned no analysis id.", "location": None}]
            for _ in range(24):
                time.sleep(5)
                r2 = client.get(f"https://api.mythx.io/v1/analyses/{uuid}", headers={"Authorization": f"Bearer {key}"})
                if r2.status_code != 200:
                    continue
                doc = r2.json()
                status = (doc.get("status") or doc.get("data") or {}).get("status") or ""
                if status.lower() in ("finished", "complete", "done"):
                    issues = (doc.get("issues") or (doc.get("data") or {}).get("issues") or [])
                    out = []
                    for i in issues:
                        out.append({
                            "severity": (i.get("severity") or "medium").lower(),
                            "title": i.get("title") or i.get("swcId") or "Finding",
                            "description": i.get("description") or "",
                            "location": i.get("location") or i.get("sourceLocation", {}).get("sourceMap"),
                            "category": i.get("swcId"),
                        })
                    return out
            return [{"severity": "info", "title": "MythX", "description": "MythX analysis timed out; check dashboard.", "location": None}]
    except Exception as e:
        return [{"severity": "info", "title": "MythX", "description": f"MythX error: {e}", "location": None}]


def _detect_contract_type(code: str) -> str | None:
    """Detect ERC20 vs ERC721 from code. Returns 'erc20', 'erc721', or None if unsupported."""
    lower = code.lower()
    has_total_supply = "totalsupply" in lower or "total_supply" in lower
    has_balance_of = "balanceof" in lower or "balance_of" in lower
    has_owner_of = "ownerof" in lower or "owner_of" in lower
    has_token_uri = "tokenuri" in lower or "token_uri" in lower
    if has_total_supply and has_balance_of:
        return "erc20"
    if (has_balance_of and has_owner_of) or (has_balance_of and has_token_uri):
        return "erc721"
    if has_balance_of:
        return "erc20"
    return None


def _select_harness_path(contract_type: str | None) -> Path | None:
    """Return harness path for contract type. Fail-closed: None when unsupported."""
    if contract_type == "erc20":
        p = os.environ.get("ECHIDNA_HARNESS_PATH", "services/audit/echidna_harness/ERC20Harness.sol").strip()
        return Path(p) if p else None
    if contract_type == "erc721":
        p = os.environ.get("ECHIDNA_HARNESS_ERC721_PATH", "services/audit/echidna_harness/ERC721Harness.sol").strip()
        return Path(p) if p else None
    return None


def _run_echidna(workdir: Path, contract_name: str, code: str) -> list[dict]:
    """Run Echidna fuzzing. Harness selection by contract type. Fail-closed when unsupported."""
    contract_type = _detect_contract_type(code)
    harness_file = _select_harness_path(contract_type)
    if harness_file is None:
        if contract_type is None:
            return [{"severity": "high", "title": "Echidna", "description": "Contract type not supported for Echidna. Supported: ERC20, ERC721. Add totalSupply+balanceOf (ERC20) or balanceOf+ownerOf (ERC721).", "location": None, "category": "echidna"}]
        return [{"severity": "info", "title": "Echidna", "description": "Set ECHIDNA_HARNESS_PATH or ECHIDNA_HARNESS_ERC721_PATH.", "location": None}]
    if not harness_file.exists():
        return [{"severity": "high", "title": "Echidna", "description": f"Harness not found: {harness_file}. Unsupported contract type or missing harness.", "location": None, "category": "echidna"}]
    timeout = int(os.environ.get("ECHIDNA_TIMEOUT", "60") or "60")
    src = workdir / "src"
    src.mkdir(parents=True, exist_ok=True)
    if "pragma solidity" not in code.strip().lower():
        code = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\n" + code
    (src / f"{contract_name}.sol").write_text(code)
    (workdir / "foundry.toml").write_text('[profile.default]\nsolc = "0.8.24"\n')
    harness_code = harness_file.read_text()
    if contract_name not in harness_code:
        harness_code = harness_code.replace("Contract", contract_name)
    (src / "Harness.sol").write_text(harness_code)
    try:
        result = subprocess.run(
            ["echidna", str(src / "Harness.sol"), "--contract", "Harness", "--format", "json", "--timeout", str(timeout)],
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=timeout + 30,
        )
    except FileNotFoundError:
        return [{"severity": "info", "title": "Echidna", "description": "Echidna binary not installed. Install: https://github.com/crytic/echidna", "location": None}]
    out: list[dict] = []
    if result.stdout:
        try:
            data = json.loads(result.stdout)
            for issue in data.get("success", []) or []:
                if isinstance(issue, dict) and issue.get("status") == "failed":
                    out.append({
                        "severity": "high",
                        "title": issue.get("name", "Invariant failed"),
                        "description": str(issue.get("error", "") or "Fuzzer found failing input"),
                        "location": issue.get("filename"),
                        "category": "echidna",
                    })
        except json.JSONDecodeError:
            pass
    return out if out else [{"severity": "info", "title": "Echidna", "description": "No issues found" if result.returncode == 0 else "Echidna run completed", "location": None}]


def _normalize_severity(s: str) -> str:
    s = (s or "info").lower()
    for sev in ("critical", "high", "medium", "low", "info"):
        if sev in s:
            return sev
    return "info"


@app.post("/audit/slither")
def audit_slither(req: AuditRequest) -> list[Finding]:
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        out = _run_slither(Path(tmp), name, req.contractCode)
    return [Finding(severity=_normalize_severity(f["severity"]), title=f["title"], description=f["description"], location=f.get("location"), category=f.get("category")) for f in out]


@app.post("/audit/mythril")
def audit_mythril(req: AuditRequest) -> list[Finding]:
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        out = _run_mythril(Path(tmp), name, req.contractCode)
    return [Finding(severity=_normalize_severity(f["severity"]), title=f["title"], description=f["description"], location=f.get("location"), category=f.get("category")) for f in out]


@app.post("/audit/mythx")
def audit_mythx(req: AuditRequest) -> list[Finding]:
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        out = _run_mythx(Path(tmp), name, req.contractCode)
    return [Finding(severity=_normalize_severity(f["severity"]), title=f["title"], description=f["description"], location=f.get("location"), category=f.get("category")) for f in out]


@app.post("/audit/echidna")
def audit_echidna(req: AuditRequest) -> list[Finding]:
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        out = _run_echidna(Path(tmp), name, req.contractCode)
    return [Finding(severity=_normalize_severity(f["severity"]), title=f["title"], description=f["description"], location=f.get("location"), category=f.get("category")) for f in out]


@app.post("/audit/exploit")
def audit_exploit(req: AuditRequest) -> dict:
    """Run Slither with exploit-focused detectors (reentrancy, unchecked-transfer, etc). Used by exploit_sim agent."""
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        out = _run_slither_exploit(Path(tmp), name, req.contractCode)
    findings = [{"severity": _normalize_severity(f["severity"]), "title": f["title"], "description": f["description"], "location": f.get("location"), "category": f.get("category")} for f in out]
    return {"findings": findings, "tools_run": ["slither-exploit"]}


def _run_audit_via_tools(tool: str, req: AuditRequest) -> tuple[list[dict], bool] | None:
    """When TOOLS_BASE_URL is set and tool is slither or mythril, call remote hyperagent-tools."""
    if not TOOLS_BASE_URL or tool not in ("slither", "mythril"):
        return None
    name = _safe_contract_name(req.contractName)
    file_name = f"{name}.sol" if not name.endswith(".sol") else name
    contract_name = name.replace(".sol", "") if name.endswith(".sol") else name
    files = {f"contracts/{file_name}": req.contractCode}
    entry = f"contracts/{file_name}:{contract_name}"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if TOOLS_API_KEY:
        headers["X-TOOLS-API-KEY"] = TOOLS_API_KEY
    try:
        with httpx.Client(timeout=180.0) as client:
            r = client.post(
                f"{TOOLS_BASE_URL}/audit",
                headers=headers,
                json={"tool": tool, "solcVersion": "0.8.24", "files": files, "entry": entry},
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError:
        return ([], False)
    artifacts = data.get("artifacts") or {}
    issues = artifacts.get("issues") or []
    out: list[dict] = []
    for i in issues:
        out.append({
            "severity": (i.get("severity") or "info").lower(),
            "title": i.get("title") or "Finding",
            "description": i.get("description") or "",
            "location": i.get("location"),
            "category": i.get("category"),
        })
    return (out, True)


def _run_one_tool(tool: str, req: AuditRequest) -> tuple[list[dict], bool]:
    """Run one tool; return (findings_dict_list, success). On timeout or exception, return ([], False)."""
    remote = _run_audit_via_tools(tool, req)
    if remote is not None:
        return remote
    name = _safe_contract_name(req.contractName)
    with tempfile.TemporaryDirectory(prefix="audit_") as tmp:
        workdir = Path(tmp)
        if tool == "slither":
            out = _run_slither(workdir, name, req.contractCode)
        elif tool == "mythril":
            out = _run_mythril(workdir, name, req.contractCode)
        elif tool == "mythx":
            out = _run_mythx(workdir, name, req.contractCode)
        elif tool == "echidna":
            out = _run_echidna(workdir, name, req.contractCode)
        else:
            return ([], False)
        return (out, True)


AUDIT_MODE = (os.environ.get("AUDIT_MODE") or "local").strip().lower()
MYTHX_DEFAULT = AUDIT_MODE == "mythx" or bool(os.environ.get("MYTHX_API_KEY"))


@app.post("/audit")
def audit(req: AuditRequest, tool: str = "slither") -> AuditResponse:
    """Run one or more tools (comma-separated). Returns unified schema with findings, tools_run, tools_failed."""
    import concurrent.futures
    tools = [t.strip().lower() for t in tool.split(",") if t.strip()]
    if not tools:
        tools = ["mythx", "slither"] if MYTHX_DEFAULT else ["slither", "mythril"]
    allowed = {"slither", "mythril", "mythx", "echidna"}
    invalid = [t for t in tools if t not in allowed]
    if invalid:
        raise HTTPException(status_code=400, detail=f"tool must be one of {sorted(allowed)}; got {invalid}")
    findings: list[Finding] = []
    tools_run: list[str] = []
    tools_failed: list[str] = []
    TOOL_TIMEOUT_SEC = 300
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(_run_one_tool, t, req): t for t in tools}
        for fut in concurrent.futures.as_completed(futures):
            t = futures[fut]
            try:
                out_list, ok = fut.result(timeout=TOOL_TIMEOUT_SEC)
                if ok:
                    tools_run.append(t)
                    for f in out_list:
                        findings.append(Finding(
                            severity=_normalize_severity(f.get("severity", "info")),
                            title=f.get("title", ""),
                            description=f.get("description", ""),
                            location=f.get("location"),
                            category=f.get("category"),
                        ))
                else:
                    tools_failed.append(t)
            except (concurrent.futures.TimeoutError, Exception):
                tools_failed.append(t)
    return AuditResponse(findings=findings, tools_run=tools_run, tools_failed=tools_failed)


@app.get("/health")
def health():
    return {"status": "ok"}
