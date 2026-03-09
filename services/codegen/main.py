"""
Codegen service: facade for code generation (agent-runtime) and compilation (compile service).
Optional X-Idempotency-Key; safe logging (no spec/design/code or keys).
"""
import os
import time
import httpx
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field

app = FastAPI(title="HyperAgent Codegen Service", version="0.1.0")

AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001").rstrip("/")
COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")

IDEMPOTENCY_TTL_SEC = 60
_idempotency_cache: dict[str, tuple[float, dict]] = {}


class GenerateRequest(BaseModel):
    spec: dict
    design: dict = Field(default_factory=dict)
    context: dict = Field(default_factory=dict)
    workflow_id: str | None = None
    run_id: str | None = None


class CompileRequest(BaseModel):
    contractCode: str = Field(..., alias="contractCode")
    framework: str = Field(..., pattern="^(hardhat|foundry)$")
    workflow_id: str | None = None
    run_id: str | None = None
    model_config = {"populate_by_name": True}


def _log_safe(operation: str, run_id: str | None, workflow_id: str | None, status: str) -> None:
    rid = run_id or workflow_id or ""
    if rid:
        import logging as _logging
        _logging.getLogger("codegen").info("[codegen] %s run_id=%s status=%s", operation, rid, status)


@app.post("/generate")
async def generate(
    req: GenerateRequest,
    x_idempotency_key: str | None = Header(None, alias="X-Idempotency-Key"),
) -> dict:
    """Proxy to agent-runtime /agents/codegen. Optional X-Idempotency-Key."""
    cache_key = f"gen:{x_idempotency_key}" if x_idempotency_key else None
    if cache_key:
        now = time.time()
        if cache_key in _idempotency_cache:
            cached_at, cached = _idempotency_cache[cache_key]
            if now - cached_at < IDEMPOTENCY_TTL_SEC:
                _log_safe("generate", req.run_id, req.workflow_id, "cached")
                return cached
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{AGENT_RUNTIME_URL}/agents/codegen",
                json={"spec": req.spec, "design": req.design, "context": req.context},
            )
            if r.status_code >= 400:
                _log_safe("generate", req.run_id, req.workflow_id, "error")
                raise HTTPException(status_code=r.status_code, detail=r.text)
            out = r.json()
            _log_safe("generate", req.run_id, req.workflow_id, "ok")
            if cache_key:
                _idempotency_cache[cache_key] = (time.time(), out)
            return out
    except HTTPException:
        raise
    except Exception as e:
        _log_safe("generate", req.run_id, req.workflow_id, "error")
        raise


@app.post("/compile")
async def compile_contract(
    req: CompileRequest,
    x_idempotency_key: str | None = Header(None, alias="X-Idempotency-Key"),
) -> dict:
    """Proxy to compile service. Returns same envelope (success, bytecode, abi, errors). Optional X-Idempotency-Key."""
    cache_key = f"comp:{x_idempotency_key}" if x_idempotency_key else None
    if cache_key:
        now = time.time()
        if cache_key in _idempotency_cache:
            cached_at, cached = _idempotency_cache[cache_key]
            if now - cached_at < IDEMPOTENCY_TTL_SEC:
                _log_safe("compile", req.run_id, req.workflow_id, "cached")
                return cached
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{COMPILE_SERVICE_URL}/compile",
                json={"contractCode": req.contractCode, "framework": req.framework},
            )
            if r.status_code >= 400:
                _log_safe("compile", req.run_id, req.workflow_id, "error")
                raise HTTPException(status_code=r.status_code, detail=r.text)
            out = r.json()
            _log_safe("compile", req.run_id, req.workflow_id, "ok")
            if cache_key:
                _idempotency_cache[cache_key] = (time.time(), out)
            return out
    except HTTPException:
        raise
    except Exception as e:
        _log_safe("compile", req.run_id, req.workflow_id, "error")
        raise


@app.get("/health")
def health():
    return {"status": "ok"}
