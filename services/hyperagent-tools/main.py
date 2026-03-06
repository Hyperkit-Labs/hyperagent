"""
HyperAgent Tools Service
Unified compile and audit API. Dummy responses for now; Foundry/Hardhat/Slither added later.
"""

import os

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="HyperAgent Tools Service", version="0.1.0")

TOOLS_API_KEY = os.environ.get("TOOLS_API_KEY")


def _require_api_key(x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY")) -> None:
    """When TOOLS_API_KEY is set, require X-TOOLS-API-KEY header on requests."""
    if TOOLS_API_KEY and x_tools_api_key != TOOLS_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-TOOLS-API-KEY")


# --- Compile ---


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


# --- Audit ---


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


# --- Routes ---


@app.post("/compile", response_model=CompileResponse)
def compile_contract(
    req: CompileRequest,
    x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY"),
) -> CompileResponse:
    _require_api_key(x_tools_api_key)
    contract_name = req.entry.split(":")[-1] if ":" in req.entry else req.entry.replace(".sol", "")
    return CompileResponse(
        success=True,
        artifacts=CompileArtifacts(
            abi=[],
            bytecode="0x",
            contractName=contract_name,
        ),
    )


@app.post("/audit", response_model=AuditResponse)
def audit_contract(
    req: AuditRequest,
    x_tools_api_key: str | None = Header(None, alias="X-TOOLS-API-KEY"),
) -> AuditResponse:
    _require_api_key(x_tools_api_key)
    return AuditResponse(success=True, artifacts=AuditArtifacts(issues=[]))


@app.get("/health")
def health() -> dict:
    """Health check; no API key required for load balancers."""
    return {"status": "ok"}
