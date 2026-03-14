"""
HyperAgent Orchestrator
FastAPI app: workflows CRUD, runs, networks, metrics, BYOK, deploy, UI schema. Studio contract for E2E.
"""

from pathlib import Path

# Load .env from repo root so X402_ENABLED, CREDITS_ENABLED, etc. are available when running locally.
# Docker passes env via env_file; dotenv is a no-op when vars are already set.
try:
    from dotenv import load_dotenv

    _repo_root = Path(__file__).resolve().parent.parent.parent
    _env_path = _repo_root / ".env"
    if _env_path.exists():
        load_dotenv(_env_path)
except ImportError:
    pass

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)


def _log_byok_event(event: str, user_id: str, action: str) -> None:
    """Structured security log for BYOK access (no key values)."""
    logger.warning(
        "[security] %s",
        json.dumps({"event": event, "byok_action": action, "user_id": user_id}),
    )


import io
import tarfile
import zipfile

import credits_supabase
import db
import httpx
import llm_keys_supabase
import payments_supabase
from fastapi import BackgroundTasks, Body, FastAPI, Header, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from input_guardrail import validate_input as guardrail_validate_input
from llm_keys_store import (
    DEFAULT_WORKSPACE,
    delete_keys,
    get_configured_providers,
    get_keys_for_pipeline,
    set_keys,
)
from pydantic import BaseModel, Field
from registries import (
    ANCHOR_NETWORK_SLUG,
    DEFAULT_PIPELINE_ID,
    get_a2a_agent_id,
    get_a2a_default_chain_id,
    get_chain_id_by_network_slug,
    get_chain_rpc_explorer,
    get_default_chain_id,
    get_erc8004_agent_identity,
    get_monitoring_enabled,
    get_networks_for_api,
    get_registry_versions,
    get_resource_price,
    get_stablecoins_by_chain,
    get_templates_for_api,
    get_timeout,
    get_x402_enabled,
    get_x402_plan,
    get_x402_plans,
    get_x402_resources,
)
from store import (
    MAX_INTENT_LENGTH,
    append_deployment,
    count_workflows,
    create_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
)
from structured_logging import TraceContextFilter
from trace_context import get_trace_headers, set_request_id
from workflow import run_pipeline

# Wire structured logging so run_id, request_id, step_id propagate to all logs
_root_logger = logging.getLogger()
if not any(isinstance(f, TraceContextFilter) for f in _root_logger.filters):
    _root_logger.addFilter(TraceContextFilter())

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")
AUDIT_SERVICE_URL = os.environ.get("AUDIT_SERVICE_URL", "http://localhost:8001").rstrip(
    "/"
)


# Map store status to runs.status (pending|running|success|failed|cancelled)
def _run_status_for_store(status: str) -> str:
    if status == "completed":
        return "success"
    if status == "failed":
        return "failed"
    return "running"


def _get_keys_for_run(user_id: str, workspace_id: str) -> dict[str, str]:
    """Resolve BYOK keys: Supabase by user_id when configured (no in-memory fallback); else in-memory by workspace for dev only."""
    if llm_keys_supabase._is_configured():
        if user_id:
            return llm_keys_supabase.get_keys_for_user(user_id)
        return {}
    return get_keys_for_pipeline(workspace_id or DEFAULT_WORKSPACE)


def _create_agent_session_jwt_if_configured(
    user_id: str, run_id: str, api_keys: dict
) -> str | None:
    """When JWT_SECRET_KEY and AGENT_SESSION_PAYLOAD_KEY are set, return short-lived JWT with encrypted api_keys."""
    if not api_keys:
        return None
    if not os.environ.get("JWT_SECRET_KEY") or not os.environ.get(
        "AGENT_SESSION_PAYLOAD_KEY"
    ):
        return None
    try:
        from agent_session_jwt import create_agent_session_jwt

        return create_agent_session_jwt(sub=user_id, run_id=run_id, api_keys=api_keys)
    except Exception as e:
        logger.error(
            "[agent-session] JWT creation failed user_id=%s run_id=%s: %s",
            user_id,
            run_id,
            e,
            exc_info=True,
        )
        return None


app = FastAPI(title="HyperAgent Orchestrator", version="0.1.0")


def _is_production() -> bool:
    """True when RENDER=true or NODE_ENV=production or similar production indicators."""
    return (
        os.environ.get("RENDER", "").strip().lower() in ("1", "true", "yes")
        or os.environ.get("NODE_ENV", "").strip().lower() == "production"
        or os.environ.get("ENVIRONMENT", "").strip().lower() == "production"
    )


def _ipfs_configured() -> bool:
    """True when IPFS/Pinata or storage service is configured for trace provenance."""
    if os.environ.get("PINATA_API_KEY") or os.environ.get("PINATA_JWT"):
        return True
    storage = os.environ.get("STORAGE_SERVICE_URL", "").strip()
    if storage and "localhost" not in storage:
        return True
    return bool(os.environ.get("IPFS_ENABLED"))


@app.on_event("startup")
def _validate_critical_services() -> None:
    """Log missing critical service URLs. Full lifecycle requires compile, audit, agent-runtime.
    In production, REDIS_URL is required for checkpoint persistence (warn, don't crash).
    ZSPS: In production, IPFS is required for verifiable traces; refuse start when unconfigured."""
    if _is_production():
        redis_url = os.environ.get("REDIS_URL", "").strip()
        if not redis_url:
            logger.error(
                "[orchestrator] REDIS_URL is not set in production. "
                "Checkpoint persistence will use in-memory fallback (data lost on restart). "
                "Set REDIS_URL to a Redis instance (e.g. Redis Cloud) in Coolify Shared Env."
            )
        if not _ipfs_configured():
            logger.error(
                "[orchestrator] IPFS not configured in production. "
                "Verifiable trace provenance is mandatory. Set PINATA_JWT, PINATA_API_KEY, "
                "or STORAGE_SERVICE_URL to a real storage service."
            )
            raise RuntimeError(
                "IPFS/Storage required in production. Set PINATA_JWT, PINATA_API_KEY, or STORAGE_SERVICE_URL."
            )
    required = [
        ("COMPILE_SERVICE_URL", COMPILE_SERVICE_URL),
        ("AUDIT_SERVICE_URL", AUDIT_SERVICE_URL),
        ("AGENT_RUNTIME_URL", os.environ.get("AGENT_RUNTIME_URL", "").strip()),
    ]
    missing = [k for k, v in required if not v or v.startswith("http://localhost:")]
    if missing:
        logger.warning(
            "[orchestrator] Critical services not configured: %s. "
            "Workflow pipeline will fail. Set env vars in Contabo/Coolify.",
            ", ".join(missing),
        )
    from pathlib import Path

    scrubd_path = os.environ.get("SCRUBD_PATH", "./data/SCRUBD").strip()
    labels = Path(scrubd_path).resolve() / "SCRUBD-CD" / "data" / "labels.csv"
    if not labels.exists():
        logger.warning(
            "[orchestrator] SCRUBD dataset not found at %s. "
            "Clone during build: git clone --depth 1 --branch V6.0 https://github.com/sujeetc/SCRUBD data/SCRUBD",
            labels,
        )


# In-memory latency buffer for p95 measurement (last 1000 requests, excludes /health and streaming)
_request_latencies: list[float] = []
_LATENCY_BUFFER_SIZE = 1000


@app.middleware("http")
async def log_request_id(request: Request, call_next):
    """Set and log x-request-id for trace correlation; downstream services receive it from gateway.
    Records request latency for p95 SLO measurement (excludes /health and streaming).
    Emits OpenTelemetry span per request when OPENTELEMETRY_ENABLED is set."""
    rid = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    ).strip() or None
    set_request_id(rid)
    if rid:
        logger.info("[orchestrator] request_id=%s path=%s", rid, request.url.path)
    start = time.perf_counter()
    from otel_spans import span

    with span(
        "orchestrator.request",
        step_type="http",
        path=request.url.path,
        method=request.method,
        request_id=rid,
    ):
        response = await call_next(request)
    elapsed = time.perf_counter() - start
    path = request.url.path or ""
    if "/health" not in path and "/streaming/" not in path:
        global _request_latencies
        _request_latencies.append(elapsed)
        if len(_request_latencies) > _LATENCY_BUFFER_SIZE:
            _request_latencies = _request_latencies[-_LATENCY_BUFFER_SIZE:]
    response.headers["X-Response-Time-Ms"] = f"{elapsed * 1000:.0f}"
    return response


def _p95_latency_ms() -> float | None:
    """Return p95 latency in ms from recent requests, or None if insufficient data."""
    if len(_request_latencies) < 10:
        return None
    sorted_ = sorted(_request_latencies)
    idx = int(len(sorted_) * 0.95) - 1
    idx = max(0, idx)
    return sorted_[idx] * 1000


# ---------------------------------------------------------------------------
# Auth helpers (from api.common for modularization)
# ---------------------------------------------------------------------------

from api.common import assert_workflow_owner as _assert_workflow_owner
from api.common import get_caller_id as _get_caller_id


import re as _re

_SAFE_IDENT = _re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
_SAFE_NAME = _re.compile(r"^[A-Za-z0-9 _\-]{1,64}$")


def _sanitize_ident(value: str, fallback: str = "fn") -> str:
    """Ensure a value is safe to embed as a JS/TS identifier."""
    if _SAFE_IDENT.match(value or ""):
        return value
    cleaned = _re.sub(r"[^A-Za-z0-9_]", "", value or "")
    return cleaned[:64] if cleaned else fallback


def _sanitize_label(value: str, fallback: str = "Action") -> str:
    """Escape HTML entities in labels to prevent XSS in generated code."""
    safe = (
        (value or fallback)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return safe[:128]


def _sanitize_name(value: str, fallback: str = "dapp") -> str:
    """Validate app name for safe filesystem and display usage."""
    if _SAFE_NAME.match(value or ""):
        return value
    cleaned = _re.sub(r"[^A-Za-z0-9 _\-]", "", value or "")
    return cleaned[:64] if cleaned else fallback


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------


class RunRequest(BaseModel):
    user_prompt: str = Field(..., min_length=1, max_length=MAX_INTENT_LENGTH)
    user_id: str = ""
    project_id: str = ""
    pipeline_id: str = DEFAULT_PIPELINE_ID
    api_keys: dict = Field(default_factory=dict)


class CreateWorkflowBody(BaseModel):
    nlp_input: str = Field(
        ..., alias="nlp_input", min_length=1, max_length=MAX_INTENT_LENGTH
    )
    network: str | None = None
    user_id: str = ""
    project_id: str = ""
    pipeline_id: str = DEFAULT_PIPELINE_ID
    api_keys: dict = Field(default_factory=dict)
    template_id: str | None = None
    auto_approve: bool = False
    model_config = {"populate_by_name": True}


# ---------------------------------------------------------------------------
# Workflow lifecycle
# ---------------------------------------------------------------------------


def _run_workflow_pipeline_job(
    workflow_id: str,
    user_id: str,
    project_id: str,
    nlp_input: str,
    api_keys: dict,
    pipeline_id: str | None,
    agent_session_jwt: str | None,
    template_id: str | None,
    request_id: str | None = None,
    auto_approve: bool = False,
    network: str = "",
) -> None:
    """Background job: run LangGraph pipeline and persist workflow + run status."""
    set_request_id(request_id)
    logger.info(
        "[pipeline] job start workflow_id=%s api_keys_providers=%s agent_session_jwt=%s",
        workflow_id,
        list(api_keys.keys()) if api_keys else [],
        "yes" if agent_session_jwt else "no",
    )
    if request_id:
        logger.info(
            "[orchestrator] pipeline start workflow_id=%s request_id=%s",
            workflow_id,
            request_id,
        )
    if api_keys and user_id:
        _log_byok_event("byok_keys_used", user_id, "run_pipeline")
    try:
        initial_override: dict = {}
        if auto_approve:
            initial_override["auto_approve"] = True
        if network:
            initial_override["network"] = network
        final = run_pipeline(
            nlp_input,
            user_id,
            project_id,
            workflow_id,
            api_keys,
            pipeline_id,
            agent_session_jwt=agent_session_jwt,
            template_id=template_id,
            request_id=request_id,
            initial_state_override=initial_override or None,
        )
        current_stage = final.get("current_stage") or "unknown"
        if auto_approve and current_stage == "awaiting_deploy_approval":
            logger.info(
                "[orchestrator] auto_approve: resuming deploy for workflow_id=%s",
                workflow_id,
            )
            final = run_pipeline(
                nlp_input,
                user_id,
                project_id,
                workflow_id,
                api_keys,
                pipeline_id,
                checkpoint_id=workflow_id,
                resume_update={"deploy_approved": True, "user_prompt": nlp_input},
            )
            current_stage = final.get("current_stage") or "unknown"
        status = (
            "completed"
            if current_stage in ("deployed", "deploy", "ui_scaffold")
            else (
                "failed"
                if current_stage in ("audit_failed", "simulation_failed", "failed")
                else "building"
            )
        )
        autofix_cycle = final.get("autofix_cycle", 0)
        guardian_violations = final.get("invariant_violations") or []
        stages = [
            {"stage": "spec", "status": "completed"},
            {
                "stage": "design",
                "status": "completed" if final.get("design_proposal") else "pending",
            },
            {
                "stage": "codegen",
                "status": "completed" if final.get("contracts") else "pending",
            },
            {
                "stage": "test_generation",
                "status": "completed" if final.get("test_files") else "pending",
            },
            {
                "stage": "audit",
                "status": (
                    "completed"
                    if final.get("audit_passed")
                    else ("failed" if final.get("audit_findings") else "pending")
                ),
            },
        ]
        if autofix_cycle > 0:
            stages.append(
                {"stage": "autofix", "status": "completed", "cycles": autofix_cycle}
            )
        if final.get("invariants"):
            stages.append(
                {
                    "stage": "guardian",
                    "status": "failed" if guardian_violations else "completed",
                }
            )
        stages += [
            {
                "stage": "simulation",
                "status": (
                    "completed"
                    if final.get("simulation_passed")
                    else (
                        "failed"
                        if final.get("simulation_results")
                        and not final.get("simulation_passed")
                        else "pending"
                    )
                ),
            },
            {
                "stage": "deploy",
                "status": (
                    "completed"
                    if current_stage in ("deployed", "ui_scaffold")
                    else "pending"
                ),
            },
            {
                "stage": "ui_scaffold",
                "status": "completed" if final.get("ui_schema") else "pending",
            },
        ]
        codegen_mode = "oz_wizard" if final.get("use_oz_wizard") else "custom"
        oz_opts = final.get("oz_wizard_options") or None
        update_workflow(
            workflow_id=workflow_id,
            status=status,
            current_stage=current_stage,
            stages=stages,
            contracts=final.get("contracts") or {},
            deployments=final.get("deployments") or [],
            test_files=final.get("test_files") or {},
            ui_schema=final.get("ui_schema"),
            error=final.get("error"),
            codegen_mode=codegen_mode,
            oz_wizard_options=oz_opts,
            simulation_passed=final.get("simulation_passed"),
            simulation_results=final.get("simulation_results"),
            audit_findings=final.get("audit_findings"),
        )
        if db.is_configured():
            db.update_run(
                workflow_id,
                status=_run_status_for_store(status),
                current_stage=current_stage,
                error_message=final.get("error"),
                stages=stages,
            )
        if (
            get_x402_enabled()
            and payments_supabase.is_configured()
            and user_id
            and db._is_uuid(user_id)
            and status == "completed"
        ):
            try:
                payments_supabase.insert_payment(
                    user_id,
                    amount=0.15,
                    currency="USD",
                    resource_id="pipeline.run",
                    endpoint="/api/v1/workflows/generate",
                    status="completed",
                    metadata={
                        "workflow_id": workflow_id,
                        "current_stage": current_stage,
                    },
                )
            except Exception as pay_err:
                logger.warning(
                    "[x402] insert_payment failed workflow_id=%s err=%s",
                    workflow_id,
                    pay_err,
                )
    except Exception as e:
        err_msg = str(e)
        update_workflow(workflow_id=workflow_id, status="failed", error=err_msg)
        if db.is_configured():
            db.update_run(workflow_id, status="failed", error_message=err_msg)
    finally:
        try:
            api_keys.clear()
        except Exception:
            pass


CREDITS_PER_RUN = float(os.environ.get("CREDITS_PER_RUN", "7"))
CREDITS_PER_USD = float(os.environ.get("CREDITS_PER_USD", "10"))


@app.post("/api/v1/workflows/generate")
def workflows_generate(
    body: CreateWorkflowBody,
    background_tasks: BackgroundTasks,
    request: Request,
) -> dict[str, Any]:
    """Studio contract: create workflow from nlp_input; persist and return workflow_id.

    Phase 2: create workflow + DB run, enqueue background pipeline job, return quickly with workflow_id.
    Studio polls /api/v1/workflows/{id} and /api/v1/runs/{id}/steps for progress.
    Credit-based: when credits_supabase is configured, deducts credits per run (CREDITS_PER_RUN); insufficient balance returns 402.
    """
    x_user_id = (
        request.headers.get("X-User-Id") or request.headers.get("x-user-id") or ""
    ).strip() or None
    workflow_id = str(uuid.uuid4())
    # Never trust client-passed user_id. Gateway sets X-User-Id from JWT sub (wallet_users.id).
    user_id = x_user_id or "anonymous"
    project_id = body.project_id or workflow_id
    if credits_supabase.is_configured() and user_id and db._is_uuid(user_id):
        if not credits_supabase.has_sufficient_credits(user_id, CREDITS_PER_RUN):
            bal = credits_supabase.get_balance(user_id)
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient credits. Balance: {bal.get('balance', 0)} {bal.get('currency', 'USD')}. Top up in Settings or Payments.",
            )
        ok, _ = credits_supabase.consume(
            user_id,
            CREDITS_PER_RUN,
            reference_id=workflow_id,
            reference_type="workflow_run",
            metadata={"pipeline_id": body.pipeline_id or DEFAULT_PIPELINE_ID},
        )
        if not ok:
            raise HTTPException(
                status_code=402,
                detail="Failed to deduct credits. Top up and try again.",
            )
    api_keys = body.api_keys or _get_keys_for_run(user_id, DEFAULT_WORKSPACE)
    logger.info(
        "[generate] user_id=%s body_keys=%s supabase_keys=%s resolved=%s",
        user_id,
        list(body.api_keys.keys()) if body.api_keys else "none",
        "yes" if (not body.api_keys and api_keys) else "skipped",
        list(api_keys.keys()) if api_keys else "empty",
    )
    if not api_keys:
        raise HTTPException(
            status_code=422,
            detail="LLM API keys are required to run the pipeline. Add keys in Settings (workspace LLM keys).",
        )
    passed, violation = guardrail_validate_input(body.nlp_input)
    if not passed:
        raise HTTPException(
            status_code=400, detail=violation or "Security policy violation"
        )
    agent_session_jwt = _create_agent_session_jwt_if_configured(
        user_id, workflow_id, api_keys
    )
    if db.is_configured():
        effective_user = (
            user_id
            if db._is_uuid(user_id)
            else os.environ.get("SUPABASE_SYSTEM_USER_ID")
        )
        if effective_user:
            db.ensure_wallet_user_profile(effective_user)
        if effective_user and db.ensure_project(project_id, effective_user):
            db.insert_run(
                workflow_id, project_id, status="running", workflow_version="0.1.0"
            )
        # wallet_users.id is the only application principal; no ensure_user_profile (auth.users)
    create_workflow(
        workflow_id=workflow_id,
        intent=body.nlp_input,
        network=body.network or "",
        user_id=user_id,
        project_id=project_id,
        template_id=body.template_id,
    )
    request_id = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    ).strip() or None
    logger.info(
        "[generate] pipeline job queued workflow_id=%s api_keys_providers=%s agent_session_jwt=%s",
        workflow_id,
        list(api_keys.keys()) if api_keys else [],
        "yes" if agent_session_jwt else "no",
    )
    background_tasks.add_task(
        _run_workflow_pipeline_job,
        workflow_id,
        user_id,
        project_id,
        body.nlp_input,
        dict(api_keys),
        body.pipeline_id,
        agent_session_jwt,
        body.template_id,
        request_id,
        body.auto_approve,
        body.network or "",
    )
    return {"workflow_id": workflow_id, "status": "running"}


def _workflow_list_item(w: dict[str, Any]) -> dict[str, Any]:
    """Slim shape for list; exclude heavy contracts only so deployments show in Studio."""
    return {k: v for k, v in w.items() if k not in ("contracts",)}


@app.get("/api/v1/workflows")
def list_workflows_api(
    limit: int = 50, status: str | None = None, request: Request = None
) -> dict[str, Any]:
    """List workflows for Studio. Newest first. Scoped to authenticated user."""
    items = list_workflows(limit=min(limit, 100), status=status)
    caller = _get_caller_id(request) if request else None
    if caller:
        items = [
            i
            for i in items
            if (i.get("user_id") or "anonymous") in (caller, "anonymous")
        ]
    return {"workflows": [_workflow_list_item(i) for i in items]}


@app.get("/api/v1/workflows/{workflow_id}")
def get_workflow_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Return single workflow by id. Validates caller owns the workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    out = {k: v for k, v in w.items() if k not in ("contracts", "deployments")}
    out["contracts"] = w.get("contracts") or {}
    out["deployments"] = w.get("deployments") or []
    meta = w.get("metadata") or {}
    if meta.get("error") and "error" not in out:
        out["error"] = meta["error"]
    return out


@app.get("/api/v1/workflows/{workflow_id}/status")
def get_workflow_status_api(
    workflow_id: str, request: Request = None
) -> dict[str, str]:
    """Return workflow status only."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return {"status": w.get("status") or "unknown"}


@app.get("/api/v1/workflows/{workflow_id}/contracts")
def get_workflow_contracts_api(
    workflow_id: str, request: Request = None
) -> list[dict[str, Any]]:
    """Return generated contracts for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    contracts = w.get("contracts") or {}
    return [
        {
            "contract_name": name.replace(".sol", ""),
            "source_code": code,
            "contract_type": "solidity",
        }
        for name, code in contracts.items()
        if isinstance(code, str)
    ]


def _build_workflow_tarball(workflow_id: str) -> bytes:
    """Build a minimal Hardhat project tarball from workflow contracts. For Docker sandbox dynamic source."""
    w = get_workflow(workflow_id)
    if not w:
        return b""
    contracts = w.get("contracts") or {}
    if not contracts:
        return b""
    test_files = w.get("test_files") or {}
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        for name, code in contracts.items():
            if isinstance(code, str) and name.endswith(".sol"):
                name = name if "/" in name else f"contracts/{name}"
                data = code.encode("utf-8")
                ti = tarfile.TarInfo(name=name)
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
        for name, code in test_files.items():
            if isinstance(code, str) and (
                name.endswith(".sol") or name.endswith(".t.sol")
            ):
                test_path = name if "/" in name else f"test/{name}"
                data = code.encode("utf-8")
                ti = tarfile.TarInfo(name=test_path)
                ti.size = len(data)
                tf.addfile(ti, io.BytesIO(data))
        pkg = json.dumps(
            {
                "name": "hyperagent-demo",
                "scripts": {
                    "compile": "npx hardhat compile",
                    "start": "npx hardhat node",
                },
                "devDependencies": {"hardhat": "^2.19.0"},
            },
            indent=2,
        ).encode("utf-8")
        ti = tarfile.TarInfo(name="package.json")
        ti.size = len(pkg)
        tf.addfile(ti, io.BytesIO(pkg))
        hc = 'require("hardhat"); module.exports = { solidity: "0.8.24" };'
        hc_data = hc.encode("utf-8")
        ti = tarfile.TarInfo(name="hardhat.config.js")
        ti.size = len(hc_data)
        tf.addfile(ti, io.BytesIO(hc_data))
    return buf.getvalue()


@app.get("/api/v1/workflows/{workflow_id}/tarball")
def get_workflow_tarball_api(workflow_id: str, request: Request = None) -> Response:
    """Return workflow as tarball for Docker sandbox dynamic source."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    data = _build_workflow_tarball(workflow_id)
    if not data:
        raise HTTPException(status_code=400, detail="No contracts to package")
    return Response(content=data, media_type="application/gzip")


CHUNK_SIZE = 512


def _stream_workflow_code_sse(workflow_id: str):
    """Yield SSE events: data: {"text": chunk} then data: {"done": true}. Studio proxy consumes this."""
    w = get_workflow(workflow_id)
    if not w:
        return
    contracts = w.get("contracts") or {}
    parts = []
    for name, code in contracts.items():
        if isinstance(code, str):
            parts.append(f"// {name}\n{code}")
    full_source = "\n\n".join(parts) if parts else ""
    for i in range(0, len(full_source), CHUNK_SIZE):
        chunk = full_source[i : i + CHUNK_SIZE]
        yield f"data: {json.dumps({'text': chunk})}\n\n".encode()
    yield f"data: {json.dumps({'done': True})}\n\n".encode()


@app.get("/api/v1/streaming/workflows/{workflow_id}/code")
def stream_workflow_code_api(
    workflow_id: str, request: Request = None
) -> StreamingResponse:
    """SSE stream of workflow contract source for Studio code viewer. Yields data: {text} then data: {done}."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return StreamingResponse(
        _stream_workflow_code_sse(workflow_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


async def _stream_agent_discussion_sse(workflow_id: str):
    """Stream live pipeline events from run_steps and agent_logs. Cursor-based polling at 0.25s."""
    run_id = workflow_id
    seen_step_ids: set[str] = set()
    last_log_id = 0
    poll_interval = 0.25
    max_duration = 600.0
    started = time.monotonic()

    while (time.monotonic() - started) < max_duration:
        steps = db.get_steps(run_id)
        logs = db.get_agent_logs(run_id, after_id=last_log_id if last_log_id else None)

        def _log_event(log: dict) -> tuple[str, dict]:
            ts = log.get("created_at") or ""
            return (ts, {"_id": str(log.get("id", "")), "_type": "log", "event": {
                "type": "log",
                "stage": log.get("agent_name") or log.get("stage", "agent"),
                "status": "info",
                "message": (log.get("message") or log.get("stage") or "")[:1024] or None,
                "done": False,
            }})

        def _step_event(step: dict) -> tuple[str, dict]:
            ts = step.get("started_at") or step.get("completed_at") or step.get("created_at") or ""
            ev: dict = {
                "type": "step",
                "stage": step.get("step_type", "agent"),
                "status": step.get("status", "pending"),
                "message": (step.get("output_summary") or step.get("error_message") or step.get("input_summary") or step.get("status") or "")[:1024] or None,
                "done": False,
            }
            if step.get("step_type") == "human_review":
                ev["type"] = "require_action"
                ev["action"] = "approve_spec"
            return (ts, {"_id": str(step.get("id", "")), "_type": "step", "event": ev})

        merged = []
        for log in logs:
            lid = log.get("id")
            if lid is not None:
                last_log_id = max(last_log_id, int(lid))
            merged.append(_log_event(log))
        for step in steps:
            sid = str(step.get("id", ""))
            if sid and sid not in seen_step_ids:
                seen_step_ids.add(sid)
                merged.append(_step_event(step))

        merged.sort(key=lambda x: x[0])
        for _ts, item in merged:
            ev = item["event"]
            yield f"data: {json.dumps(ev)}\n\n".encode()

        completed = any(s.get("status") == "completed" for s in steps)
        if completed and steps:
            last = steps[-1]
            if last.get("step_type") in ("ui_scaffold", "deploy", "design"):
                yield f"data: {json.dumps({'stage': last.get('step_type'), 'status': 'completed', 'message': 'Pipeline step completed', 'done': True})}\n\n".encode()
                return

        await asyncio.sleep(poll_interval)

    yield f"data: {json.dumps({'stage': 'timeout', 'status': 'stopped', 'message': 'Stream ended', 'done': True})}\n\n".encode()


@app.get("/api/v1/streaming/workflows/{workflow_id}/discussion")
def stream_agent_discussion_api(
    workflow_id: str, request: Request = None
) -> StreamingResponse:
    """SSE stream of agent discussion events (autofix cycles, guardian checks) for real-time visibility."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return StreamingResponse(
        _stream_agent_discussion_sse(workflow_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@app.get("/api/v1/workflows/{workflow_id}/deployments")
def get_workflow_deployments_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Return deployments for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return {"deployments": w.get("deployments") or []}


@app.get("/api/v1/workflows/{workflow_id}/ui-schema")
def get_workflow_ui_schema_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Return UI schema for contract interaction if generated."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    schema = w.get("ui_schema")
    if not schema:
        return {"workflow_id": workflow_id, "ui_schema": None}
    return {"workflow_id": workflow_id, "ui_schema": schema}


@app.post("/api/v1/workflows/{workflow_id}/ui-schema/generate")
async def generate_workflow_ui_schema_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Generate UI schema from first deployment and contract; store and return."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    deployments = w.get("deployments") or []
    if not deployments:
        raise HTTPException(
            status_code=400, detail="No deployments; deploy a contract first"
        )
    contracts = w.get("contracts") or {}
    from agents.ui_scaffold_agent import generate_ui_schema

    schema = await generate_ui_schema(deployments, contracts, w.get("network") or "")
    if not schema:
        raise HTTPException(
            status_code=400,
            detail="Could not build schema (missing ABI or compile failed)",
        )
    update_workflow(workflow_id, ui_schema=schema)
    return {"workflow_id": workflow_id, "ui_schema": schema}


class UiAppExportBody(BaseModel):
    template: str = Field(
        default="viem-wagmi", description="viem-wagmi (default) or hyperagent-default"
    )
    include_deploy_scripts: bool = Field(
        default=True,
        description="Include deployment scripts when contract source available",
    )


def _extract_erc20_constructor_args(w: dict[str, Any]) -> list[Any]:
    """Extract constructor args (name, symbol, initialSupply) from wizard_options or spec for ERC20.
    Returns list suitable for viem deployContract: [name, symbol] or [name, symbol, initialSupply].
    """
    opts = (w.get("oz_wizard_options") or {}).copy()
    spec_wo = (w.get("spec") or {}).get("wizard_options")
    if isinstance(spec_wo, dict):
        opts.update(spec_wo)
    name = opts.get("name") or "MyToken"
    symbol = opts.get("symbol") or "MTK"
    premint = opts.get("premint") or opts.get("initialSupply")
    if premint is not None and str(premint).strip() != "":
        try:
            supply = int(str(premint).replace(",", ""))
            if supply > 0:
                return [str(name), str(symbol), supply]
        except (ValueError, TypeError):
            pass
    return [str(name), str(symbol)]


def _build_viem_wagmi_zip(
    zf: "zipfile.ZipFile",
    schema: dict[str, Any],
    app_name: str,
    chain_id: int,
    contract_addr: str,
    abi: list,
    read_actions: list,
    write_actions: list,
    rpc_url: str,
    explorer_url: str,
    chain_name: str,
) -> list[str]:
    """Add viem + wagmi Next.js scaffold to zip. Returns list of file paths written."""
    files_written: list[str] = []
    abi_json = json.dumps(abi)
    rpc_url_escaped = rpc_url.replace('"', '\\"')
    explorer_url_escaped = explorer_url.rstrip("/").replace('"', '\\"')
    chain_name_escaped = chain_name.replace('"', '\\"')

    deps = {
        "next": "14.2.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "viem": "^2.21.0",
        "wagmi": "^2.12.0",
        "@tanstack/react-query": "^5.59.0",
        "@wagmi/core": "^2.12.0",
        "tailwindcss": "^3.4.0",
    }
    zf.writestr(
        "package.json",
        json.dumps(
            {
                "name": app_name,
                "version": "0.1.0",
                "private": True,
                "scripts": {
                    "dev": "next dev",
                    "build": "next build",
                    "start": "next start",
                },
                "dependencies": deps,
                "devDependencies": {
                    "typescript": "^5.0.0",
                    "@types/react": "^18.2.0",
                    "@types/node": "^20.0.0",
                },
            },
            indent=2,
        ),
    )
    files_written.append("package.json")

    zf.writestr(
        "tsconfig.json",
        json.dumps(
            {
                "compilerOptions": {
                    "target": "es2017",
                    "lib": ["dom", "es2017"],
                    "jsx": "preserve",
                    "module": "esnext",
                    "moduleResolution": "bundler",
                    "strict": True,
                    "esModuleInterop": True,
                    "skipLibCheck": True,
                    "forceConsistentCasingInFileNames": True,
                    "resolveJsonModule": True,
                    "isolatedModules": True,
                    "noEmit": True,
                    "incremental": True,
                    "paths": {"@/*": ["./src/*"]},
                },
                "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
                "exclude": ["node_modules"],
            },
            indent=2,
        ),
    )
    files_written.append("tsconfig.json")

    zf.writestr(
        "tailwind.config.ts",
        'import type { Config } from "tailwindcss";\nconst config: Config = { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\nexport default config;\n',
    )
    zf.writestr(
        "next.config.mjs",
        '/** @type {import("next").NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n',
    )
    files_written.extend(["tailwind.config.ts", "next.config.mjs"])

    contracts_list = schema.get("contracts") or []
    if not contracts_list:
        contracts_list = [{"address": contract_addr, "name": "Contract"}]
    contracts_json = json.dumps(
        [
            {"address": c.get("address", ""), "name": c.get("name", "Contract")}
            for c in contracts_list
        ]
    )
    zf.writestr(
        "src/lib/contract.ts",
        f'''export const CONTRACTS = {contracts_json} as const;
export const CONTRACT_ADDRESS = "{contract_addr}" as const;
export const CHAIN_ID = {chain_id};
export const RPC_URL = "{rpc_url_escaped}";
export const EXPLORER_URL = "{explorer_url_escaped}";
export const ABI = {abi_json} as const;
''',
    )
    files_written.append("src/lib/contract.ts")

    zf.writestr(
        "src/lib/wagmi.ts",
        f'''import {{ http, createConfig }} from "wagmi";
import {{ injected }} from "wagmi/connectors";
import {{ CHAIN_ID, RPC_URL }} from "./contract";

export const config = createConfig({{
  chains: [{{
    id: CHAIN_ID,
    name: "{chain_name_escaped}",
    nativeCurrency: {{ decimals: 18, name: "ETH", symbol: "ETH" }},
    rpcUrls: {{ default: {{ http: [RPC_URL] }} }},
    blockExplorers: {{ default: {{ url: "{explorer_url_escaped}" }} }},
  }}],
  connectors: [injected()],
  transports: {{
    [CHAIN_ID]: http(RPC_URL),
  }},
}});
''',
    )
    files_written.append("src/lib/wagmi.ts")

    read_cards = []
    for a in read_actions[:6]:
        params = a.get("params") or []
        if a["fn"] == "balanceOf" and len(params) >= 1:
            read_cards.append(
                f"""        <div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">
          <span className="text-zinc-400 text-sm">{a.get("label", a["fn"])}</span>
          <div className="text-white font-mono mt-1">
            {{balanceOfResult?.data !== undefined ? formatUnits(balanceOfResult.data as bigint, decimalsResult?.data ?? 18) : "-"}}
          </div>
        </div>"""
            )
        elif a["fn"] == "totalSupply":
            read_cards.append(
                f"""        <div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">
          <span className="text-zinc-400 text-sm">{a.get("label", a["fn"])}</span>
          <div className="text-white font-mono mt-1">
            {{totalSupplyResult?.data !== undefined ? formatUnits(totalSupplyResult.data as bigint, decimalsResult?.data ?? 18) : "-"}}
          </div>
        </div>"""
            )
        elif a["fn"] in ("name", "symbol", "decimals"):
            v = a["fn"] + "Result"
            read_cards.append(
                f"""        <div className="p-4 bg-zinc-800/80 rounded-lg border border-zinc-700">
          <span className="text-zinc-400 text-sm">{a.get("label", a["fn"])}</span>
          <div className="text-white font-mono mt-1">{{{v}?.data ?? "-"}}</div>
        </div>"""
            )

    write_forms = []
    for a in write_actions[:6]:
        params = a.get("params") or []
        if a["fn"] == "mint" and len(params) >= 2:
            write_forms.append(
                f"""        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">{a.get("label", a["fn"])}</h3>
          <input placeholder="Recipient address" value={{mintTo}} onChange={{e => setMintTo(e.target.value)}} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />
          <input placeholder="Amount" value={{mintAmount}} onChange={{e => setMintAmount(e.target.value)}} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />
          <button onClick={{() => writeMint()}} disabled={{isMintPending}} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm">
            {{isMintPending ? "Pending..." : "Mint"}}
          </button>
          {{mintTxHash && <a href="{{EXPLORER_URL}}/tx/{{mintTxHash}}" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}}
        </div>"""
            )
        elif a["fn"] == "burn" and len(params) >= 1:
            write_forms.append(
                f"""        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">{a.get("label", a["fn"])}</h3>
          <input placeholder="Amount" value={{burnAmount}} onChange={{e => setBurnAmount(e.target.value)}} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />
          <button onClick={{() => writeBurn()}} disabled={{isBurnPending}} className="px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 text-sm">
            {{isBurnPending ? "Pending..." : "Burn"}}
          </button>
          {{burnTxHash && <a href="{{EXPLORER_URL}}/tx/{{burnTxHash}}" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}}
        </div>"""
            )
        elif a["fn"] == "transfer" and len(params) >= 2:
            write_forms.append(
                f"""        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">
          <h3 className="text-sm font-medium text-zinc-300">{a.get("label", a["fn"])}</h3>
          <input placeholder="To address" value={{transferTo}} onChange={{e => setTransferTo(e.target.value)}} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />
          <input placeholder="Amount" value={{transferAmount}} onChange={{e => setTransferAmount(e.target.value)}} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded text-sm text-white" />
          <button onClick={{() => writeTransfer()}} disabled={{isTransferPending}} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm">
            {{isTransferPending ? "Pending..." : "Transfer"}}
          </button>
          {{transferTxHash && <a href="{{EXPLORER_URL}}/tx/{{transferTxHash}}" target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 block mt-1">View tx</a>}}
        </div>"""
            )

    page_content = f'''"use client";

import {{ useState }} from "react";
import {{ WagmiProvider, useAccount, useConnect, useReadContract, useWriteContract }} from "wagmi";
import {{ QueryClient, QueryClientProvider }} from "@tanstack/react-query";
import {{ formatUnits }} from "viem";
import {{ config }} from "@/lib/wagmi";
import {{ CONTRACT_ADDRESS, ABI, EXPLORER_URL }} from "@/lib/contract";

const queryClient = new QueryClient();

function AppContent() {{
  const {{ address, isConnected }} = useAccount();
  const {{ connect, connectors, isPending: isConnectPending }} = useConnect();
  const [mintTo, setMintTo] = useState("");
  const [mintAmount, setMintAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<string | null>(null);
  const [transferTxHash, setTransferTxHash] = useState<string | null>(null);

  const {{ data: balanceOfResult }} = useReadContract({{
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  }});
  const {{ data: totalSupplyResult }} = useReadContract({{
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "totalSupply",
  }});
  const {{ data: decimalsResult }} = useReadContract({{
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "decimals",
  }});
  const {{ data: nameResult }} = useReadContract({{
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "name",
  }});
  const {{ data: symbolResult }} = useReadContract({{
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "symbol",
  }});

  const {{ writeContract: writeMintFn, isPending: isMintPending }} = useWriteContract({{
    mutation: {{ onSuccess: (data) => setMintTxHash(data) }},
  }});
  const {{ writeContract: writeBurnFn, isPending: isBurnPending }} = useWriteContract({{
    mutation: {{ onSuccess: (data) => setBurnTxHash(data) }},
  }});
  const {{ writeContract: writeTransferFn, isPending: isTransferPending }} = useWriteContract({{
    mutation: {{ onSuccess: (data) => setTransferTxHash(data) }},
  }});

  const writeMint = () => {{
    if (!mintTo || !mintAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(mintAmount) * 10 ** decimals);
    writeMintFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "mint", args: [mintTo as `0x${{string}}`, amount] }});
  }};
  const writeBurn = () => {{
    if (!burnAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(burnAmount) * 10 ** decimals);
    writeBurnFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "burn", args: [amount] }});
  }};
  const writeTransfer = () => {{
    if (!transferTo || !transferAmount) return;
    const decimals = Number(decimalsResult ?? 18);
    const amount = BigInt(parseFloat(transferAmount) * 10 ** decimals);
    writeTransferFn({{ address: CONTRACT_ADDRESS, abi: ABI, functionName: "transfer", args: [transferTo as `0x${{string}}`, amount] }});
  }};

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">{{nameResult ?? schema.get("name", "dApp")}}</h1>
        <p className="text-zinc-400 text-sm">
          Contract: <code className="text-xs">{{CONTRACT_ADDRESS}}</code> on {chain_name}
        </p>
        {{CONTRACTS.length > 1 ? (
          <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 space-y-2">
            <h2 className="text-sm font-medium text-zinc-300">Contracts</h2>
            {{CONTRACTS.map((c, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">{{c.name}}</span>
                <a href={__HREF_EXPLORER_ADDRESS__} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline font-mono text-xs">{{c.address?.slice(0, 10)}}...</a>
              </div>
            ))}}
          </div>
        ) : null}}
        {{!isConnected ? (
          <button onClick={{() => connect({{ connector: connectors[0] }})}} disabled={{isConnectPending}} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {{isConnectPending ? "Connecting..." : "Connect MetaMask"}}
          </button>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
{"\\n".join(read_cards)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{"\\n".join(write_forms) if write_forms else "              <p className=\"text-zinc-500 text-sm\">No write actions in ABI.</p>"}
            </div>
          </div>
        )}}
      </div>
    </main>
  );
}}

export default function Home() {{
  return (
    <WagmiProvider config={{config}}>
      <QueryClientProvider client={{queryClient}}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}}
'''
    page_content = page_content.replace(
        'schema.get("name", "dApp")', json.dumps(schema.get("name", "dApp"))
    )
    page_content = page_content.replace(
        "__HREF_EXPLORER_ADDRESS__", 'EXPLORER_URL + "/address/" + c.address'
    )
    zf.writestr("src/app/page.tsx", page_content)
    files_written.append("src/app/page.tsx")

    layout_title = schema.get("name", "dApp").replace('"', '\\"')
    zf.writestr(
        "src/app/layout.tsx",
        f'''import type {{ Metadata }} from "next";
import "./globals.css";

export const metadata: Metadata = {{ title: "{layout_title}", description: "Generated by HyperAgent" }};

export default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{
  return <html lang="en"><body>{{children}}</body></html>;
}}
''',
    )
    zf.writestr(
        "src/app/globals.css",
        "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;\\n",
    )
    files_written.extend(["src/app/layout.tsx", "src/app/globals.css"])

    readme = f"""# {schema.get('name', 'dApp')}

Generated by HyperAgent. Full React/Next.js dApp with viem + wagmi.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Contract

- Address: `{contract_addr}`
- Chain: {chain_name} (ID: {chain_id})
- Explorer: {explorer_url}
"""
    zf.writestr("README.md", readme)
    files_written.append("README.md")

    return files_written


@app.post("/api/v1/workflows/{workflow_id}/ui-apps/export")
def export_ui_app_api(
    workflow_id: str, body: UiAppExportBody | None = None, request: Request = None
) -> dict[str, Any]:
    """Export dApp as zip: full React/Next.js scaffold with contract integration. Returns zip_base64 and filename."""
    import base64

    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    schema = w.get("ui_schema")
    if not schema:
        raise HTTPException(
            status_code=400,
            detail="Generate UI schema first (POST /ui-schema/generate)",
        )
    template = (body.template if body else "viem-wagmi") or "viem-wagmi"
    include_deploy = body.include_deploy_scripts if body else True
    app_name = _sanitize_name(schema.get("name") or "dapp").lower().replace(" ", "-")
    chain_id = schema.get("chainId") or get_default_chain_id()
    contract_addr = schema.get("contractAddress", "")
    abi = schema.get("abi", [])
    raw_actions = schema.get("actions", [])
    for a in raw_actions:
        a["fn"] = _sanitize_ident(a.get("fn", ""), "action")
        a["label"] = _sanitize_label(a.get("label", a["fn"]))
        for p in a.get("params", []):
            p["name"] = _sanitize_ident(p.get("name", ""), "param")
    actions = raw_actions
    read_actions = [a for a in actions if a.get("kind") == "read"]
    write_actions = [a for a in actions if a.get("kind") == "write"]

    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer and template == "viem-wagmi":
        raise HTTPException(
            status_code=400,
            detail=f"Chain {chain_id} not in registry; add to infra/registries/network/chains.yaml",
        )
    rpc_url = rpc_explorer[0] if rpc_explorer else ""
    explorer_url = rpc_explorer[1] if rpc_explorer else ""
    from registries import get_chain

    chain_entry = get_chain(chain_id)
    cl = (chain_entry or {}).get("chainlist") or {}
    chain_name = (
        cl.get("name", f"Chain {chain_id}")
        if isinstance(cl, dict)
        else f"Chain {chain_id}"
    )

    buf = io.BytesIO()
    files_list: list[str] = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("ui_schema.json", json.dumps(schema, indent=2))
        files_list.append("ui_schema.json")

        if template == "viem-wagmi":
            files_list = _build_viem_wagmi_zip(
                zf,
                schema,
                app_name,
                chain_id,
                contract_addr,
                abi,
                read_actions,
                write_actions,
                rpc_url,
                explorer_url,
                chain_name,
            )
        test_files = w.get("test_files") or {}
        for name, code in test_files.items():
            if isinstance(code, str) and (
                name.endswith(".sol") or name.endswith(".t.sol")
            ):
                path = name if "/" in name else f"test/{name}"
                zf.writestr(path, code)
                files_list.append(path)

        if template != "viem-wagmi":
            zf.writestr(
                "package.json",
                json.dumps(
                    {
                        "name": app_name,
                        "version": "0.1.0",
                        "private": True,
                        "scripts": {
                            "dev": "next dev",
                            "build": "next build",
                            "start": "next start",
                        },
                        "dependencies": {
                            "next": "14.2.0",
                            "react": "^18.2.0",
                            "react-dom": "^18.2.0",
                            "ethers": "^6.13.0",
                            "tailwindcss": "^3.4.0",
                        },
                        "devDependencies": {
                            "typescript": "^5.0.0",
                            "@types/react": "^18.2.0",
                            "@types/node": "^20.0.0",
                        },
                    },
                    indent=2,
                ),
            )
            zf.writestr(
                "tsconfig.json",
                json.dumps(
                    {
                        "compilerOptions": {
                            "target": "es2017",
                            "lib": ["dom", "es2017"],
                            "jsx": "preserve",
                            "module": "esnext",
                            "moduleResolution": "bundler",
                            "strict": True,
                            "esModuleInterop": True,
                            "skipLibCheck": True,
                            "forceConsistentCasingInFileNames": True,
                            "resolveJsonModule": True,
                            "isolatedModules": True,
                            "noEmit": True,
                            "incremental": True,
                            "paths": {"@/*": ["./src/*"]},
                        },
                        "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
                        "exclude": ["node_modules"],
                    },
                    indent=2,
                ),
            )
            zf.writestr(
                "tailwind.config.ts",
                'import type { Config } from "tailwindcss";\\nconst config: Config = { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\\nexport default config;\\n',
            )
            zf.writestr(
                "next.config.mjs",
                '/** @type {import("next").NextConfig} */\\nconst nextConfig = {};\\nexport default nextConfig;\\n',
            )
            read_imports = "\\n".join(
                f"  async {a['fn']}({', '.join(p['name'] + ': string' for p in a.get('params', []))}): Promise<string> {{\\n    const result = await this.contract.{a['fn']}({', '.join(p['name'] for p in a.get('params', []))});\\n    return String(result);\\n  }}"
                for a in read_actions
            )
            write_imports = "\\n".join(
                f"  async {a['fn']}({', '.join(p['name'] + ': string' for p in a.get('params', []))}): Promise<ethers.TransactionResponse> {{\\n    return this.contract.{a['fn']}({', '.join(p['name'] for p in a.get('params', []))});\\n  }}"
                for a in write_actions
            )
            zf.writestr(
                "src/lib/contract.ts",
                f"""import {{ ethers }} from "ethers";\\n\\nexport const CONTRACT_ADDRESS = "{contract_addr}";\\nexport const CHAIN_ID = {chain_id};\\nexport const ABI = {json.dumps(abi)} as const;\\n\\nexport function getContract(signerOrProvider: ethers.Signer | ethers.Provider) {{\\n  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);\\n}}\\n""",
            )
            zf.writestr(
                "src/lib/actions.ts",
                f'import {{ ethers }} from "ethers";\\nimport {{ getContract }} from "./contract";\\n\\nexport class ContractActions {{\\n  private contract: ethers.Contract;\\n  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {{\\n    this.contract = getContract(signerOrProvider);\\n  }}\\n{read_imports}\\n{write_imports}\\n}}\\n',
            )
            action_buttons = "".join(
                f'\\n          <button onClick={{() => handleAction("{a["fn"]}")}} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">{a.get("label", a["fn"])}</button>'
                for a in write_actions[:5]
            )
            read_displays = "".join(
                f'\\n          <div className="p-3 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">{a.get("label", a["fn"])}</span><div id="{a["fn"]}" className="text-white font-mono mt-1">-</div></div>'
                for a in read_actions[:5]
            )
            zf.writestr(
                "src/app/page.tsx",
                f""""use client";\\n\\nimport {{ useState }} from "react";\\nimport {{ CONTRACT_ADDRESS, CHAIN_ID }} from "@/lib/contract";\\n\\nexport default function Home() {{\\n  const [status, setStatus] = useState("");\\n\\n  async function handleAction(fn: string) {{\\n    setStatus(`Calling ${{fn}}...`);\\n    try {{\\n      const {{ ethers }} = await import("ethers");\\n      if (!window.ethereum) {{ setStatus("Connect MetaMask"); return; }}\\n      const provider = new ethers.BrowserProvider(window.ethereum);\\n      const signer = await provider.getSigner();\\n      const {{ ContractActions }} = await import("@/lib/actions");\\n      const actions = new ContractActions(signer);\\n      const tx = await (actions as Record<string, (...args: string[]) => Promise<unknown>>)[fn]();\\n      setStatus(`TX sent: ${{String(tx)}}`); \\n    }} catch (e) {{\\n      setStatus(`Error: ${{e instanceof Error ? e.message : String(e)}}`);\\n    }}\\n  }}\\n\\n  return (\\n    <main className="min-h-screen bg-gray-900 text-white p-8">\\n      <div className="max-w-2xl mx-auto space-y-6">\\n        <h1 className="text-3xl font-bold">{schema.get("name", "dApp")}</h1>\\n        <p className="text-gray-400">Contract: <code className="text-xs">{{CONTRACT_ADDRESS}}</code> on chain {{CHAIN_ID}}</p>\\n        <div className="grid grid-cols-2 gap-3">{read_displays}\\n        </div>\\n        <div className="flex flex-wrap gap-2">{action_buttons}\\n        </div>\\n        {{status && <p className="text-sm text-yellow-400 mt-4">{{status}}</p>}}\\n      </div>\\n    </main>\\n  );\\n}}\\n\\ndeclare global {{\\n  interface Window {{ ethereum?: {{ request: (args: {{ method: string; params?: unknown[] }}) => Promise<unknown> }} }}\\n}}\\n""",
            )
            zf.writestr(
                "src/app/layout.tsx",
                f'import type {{ Metadata }} from "next";\\nimport "./globals.css";\\n\\nexport const metadata: Metadata = {{ title: "{schema.get("name", "dApp")}", description: "Generated by HyperAgent" }};\\n\\nexport default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{\\n  return <html lang="en"><body>{{children}}</body></html>;\\n}}\\n',
            )
            zf.writestr(
                "src/app/globals.css",
                "@tailwind base;\\n@tailwind components;\\n@tailwind utilities;\\n",
            )
            zf.writestr(
                "README.md",
                f"# {schema.get('name', 'dApp')}\\n\\nGenerated by HyperAgent.\\n\\n## Setup\\n\\n```bash\\nnpm install\\nnpm run dev\\n```\\n\\nOpen http://localhost:3000\\n\\n## Contract\\n\\n- Address: `{contract_addr}`\\n- Chain ID: {chain_id}\\n- Actions: {len(read_actions)} read, {len(write_actions)} write\\n",
            )
            files_list = [
                "package.json",
                "tsconfig.json",
                "tailwind.config.ts",
                "next.config.mjs",
                "src/lib/contract.ts",
                "src/lib/actions.ts",
                "src/app/page.tsx",
                "src/app/layout.tsx",
                "src/app/globals.css",
                "README.md",
            ]

        if include_deploy and w.get("contracts"):
            first_name = next(
                (
                    n
                    for n in w.get("contracts", {})
                    if isinstance(w["contracts"].get(n), str)
                ),
                None,
            )
            if first_name:
                try:
                    headers = get_trace_headers()
                    with httpx.Client(timeout=get_timeout("main")) as client:
                        r = client.post(
                            f"{COMPILE_SERVICE_URL}/compile",
                            json={
                                "contractCode": w["contracts"][first_name],
                                "framework": "hardhat",
                            },
                            headers=headers,
                        )
                        r.raise_for_status()
                        data = r.json()
                    if data.get("success") and data.get("bytecode"):
                        bytecode = data["bytecode"]
                        explorer_base = explorer_url.rstrip("/").replace("\\", "\\\\")
                        constructor_args = _extract_erc20_constructor_args(w)
                        if len(constructor_args) == 3:
                            args_ts = f"[{json.dumps(constructor_args[0])}, {json.dumps(constructor_args[1])}, BigInt({json.dumps(str(constructor_args[2]))})]"
                        elif len(constructor_args) >= 2:
                            args_ts = f"[{json.dumps(constructor_args[0])}, {json.dumps(constructor_args[1])}]"
                        else:
                            args_ts = "[]"
                        deploy_script = f"""import {{ createWalletClient, http }} from "viem";
import {{ privateKeyToAccount }} from "viem/accounts";
import {{ defineChain }} from "viem";
import {{ CHAIN_ID, RPC_URL }} from "../src/lib/contract";

const chain = defineChain({{
  id: CHAIN_ID,
  name: "Custom",
  nativeCurrency: {{ decimals: 18, name: "ETH", symbol: "ETH" }},
  rpcUrls: {{ default: {{ http: [RPC_URL] }} }},
}});

const BYTECODE = "{bytecode}" as `0x${{string}}`;
const ABI = {json.dumps(abi)};
const CONSTRUCTOR_ARGS = {args_ts};

async function main() {{
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {{ console.error("Set PRIVATE_KEY"); process.exit(1); }}
  const account = privateKeyToAccount(pk as `0x${{string}}`);
  const client = createWalletClient({{ account, chain, transport: http(RPC_URL) }});
  const hash = await client.deployContract({{ abi: ABI, bytecode: BYTECODE, account, args: CONSTRUCTOR_ARGS }});
  console.log("Deployed tx:", hash);
  console.log("Explorer:", "{explorer_base}/tx/" + hash);
}}

main().catch(console.error);
"""
                        zf.writestr("scripts/deploy.ts", deploy_script)
                        zf.writestr(
                            "contracts/Contract.sol", w["contracts"][first_name]
                        )
                        zf.writestr(
                            "scripts/chain.config.json",
                            json.dumps(
                                {
                                    "chainId": chain_id,
                                    "rpcUrl": rpc_url,
                                    "explorerUrl": explorer_url,
                                },
                                indent=2,
                            ),
                        )
                        files_list.extend(
                            [
                                "scripts/deploy.ts",
                                "contracts/Contract.sol",
                                "scripts/chain.config.json",
                            ]
                        )
                        if template == "viem-wagmi":
                            pkg = {
                                "name": app_name,
                                "version": "0.1.0",
                                "private": True,
                                "scripts": {
                                    "dev": "next dev",
                                    "build": "next build",
                                    "start": "next start",
                                    "deploy": "tsx scripts/deploy.ts",
                                },
                                "dependencies": {
                                    "next": "14.2.0",
                                    "react": "^18.2.0",
                                    "react-dom": "^18.2.0",
                                    "viem": "^2.21.0",
                                    "wagmi": "^2.12.0",
                                    "@tanstack/react-query": "^5.59.0",
                                    "@wagmi/core": "^2.12.0",
                                    "tailwindcss": "^3.4.0",
                                },
                                "devDependencies": {
                                    "typescript": "^5.0.0",
                                    "@types/react": "^18.2.0",
                                    "@types/node": "^20.0.0",
                                    "tsx": "^4.0.0",
                                },
                            }
                            zf.writestr("package.json", json.dumps(pkg, indent=2))
                except Exception as e:
                    logger.warning("[export] deploy script skipped: %s", e)

    buf.seek(0)
    zip_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    filename = f"{app_name}-{workflow_id[:8]}.zip"
    return {
        "workflow_id": workflow_id,
        "ui_schema": schema,
        "template": template,
        "zip_base64": zip_b64,
        "filename": filename,
        "files": files_list,
        "message": "React/Next.js scaffold exported; download zip and run npm install && npm run dev",
    }


class PrepareDeployBody(BaseModel):
    mainnet_confirm: bool = Field(
        False,
        description="Set true to confirm mainnet deploy; required for mainnet chain_id.",
    )


@app.post("/api/v1/workflows/{workflow_id}/deploy/prepare")
def prepare_deploy_api(
    workflow_id: str,
    request: Request,
    body: PrepareDeployBody | None = Body(None),
    chain_id: int | None = None,
) -> dict[str, Any]:
    """Compile first contract and return deploy payload for client to sign. Mainnet guarded."""
    chain_id = chain_id if chain_id is not None else get_default_chain_id()
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    _assert_workflow_owner(w, request)
    from mainnet_guard import check_mainnet_guard, is_mainnet

    allowed, reason = check_mainnet_guard(w, chain_id)
    if not allowed:
        raise HTTPException(status_code=403, detail=reason)
    if is_mainnet(chain_id) and not (body and body.mainnet_confirm):
        raise HTTPException(
            status_code=403,
            detail="Mainnet deploy requires explicit confirmation: send body with mainnet_confirm: true.",
        )
    contracts = w.get("contracts") or {}
    if not contracts:
        return {
            "workflow_id": workflow_id,
            "error": "No contracts to deploy",
            "chainId": chain_id,
        }
    first_name = next((n for n in contracts if isinstance(contracts.get(n), str)), None)
    if not first_name:
        return {
            "workflow_id": workflow_id,
            "error": "No contract source",
            "chainId": chain_id,
        }
    source = contracts[first_name]
    contract_name = first_name.replace(".sol", "")
    try:
        headers = get_trace_headers()
        with httpx.Client(timeout=get_timeout("main")) as client:
            r = client.post(
                f"{COMPILE_SERVICE_URL}/compile",
                json={"contractCode": source, "framework": "hardhat"},
                headers=headers,
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        return {"workflow_id": workflow_id, "error": str(e), "chainId": chain_id}
    if not data.get("success") or not data.get("bytecode"):
        return {
            "workflow_id": workflow_id,
            "error": (
                data.get("errors", ["Compilation failed"])[0]
                if data.get("errors")
                else "Compilation failed"
            ),
            "chainId": chain_id,
        }
    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer:
        raise HTTPException(
            status_code=400,
            detail=f"Chain {chain_id} not in registry; add to infra/registries/network/chains.yaml",
        )
    rpc_url, explorer = rpc_explorer
    return {
        "workflow_id": workflow_id,
        "deployFromConnectedAccount": True,
        "chainId": chain_id,
        "rpcUrl": rpc_url,
        "explorerUrl": explorer,
        "bytecode": data["bytecode"],
        "abi": data.get("abi") or [],
        "constructorArgs": [],
        "contractName": contract_name,
    }


class DeployCompleteBody(BaseModel):
    contractAddress: str = ""
    transactionHash: str = ""
    walletAddress: str = ""
    abi: list = Field(default_factory=list)
    chainId: int | None = None


def _build_hybrid_deploy_state(
    workflow_id: str, user_id: str, project_id: str, api_keys: dict
) -> dict[str, Any] | None:
    """Build hybrid/partially synthetic state from workflow store for deploy resume when checkpoint is missing."""
    from langchain_core.messages import HumanMessage

    w = get_workflow(workflow_id)
    if not w or not w.get("contracts"):
        return None
    intent = w.get("intent") or ""
    return {
        "user_prompt": intent,
        "user_id": user_id,
        "project_id": project_id,
        "run_id": workflow_id,
        "pipeline_id": DEFAULT_PIPELINE_ID,
        "api_keys": api_keys or {},
        "agent_session_jwt": _create_agent_session_jwt_if_configured(
            user_id, workflow_id, api_keys
        )
        or "",
        "template_id": w.get("template_id") or "",
        "use_oz_wizard": False,
        "oz_wizard_options": w.get("oz_wizard_options") or {},
        "spec": w.get("spec") or {},
        "spec_approved": True,
        "design_proposal": {},
        "design_approved": True,
        "contracts": w.get("contracts") or {},
        "test_files": w.get("test_files") or {},
        "framework": "hardhat",
        "audit_findings": w.get("audit_findings") or [],
        "audit_passed": w.get("audit_passed", True),
        "simulation_results": w.get("simulation_results") or {},
        "simulation_passed": w.get("simulation_passed", True),
        "deployments": w.get("deployments") or [],
        "ui_schema": w.get("ui_schema") or {},
        "messages": [HumanMessage(content=intent)],
        "current_stage": "deploy",
        "error": None,
        "needs_human_approval": False,
        "autofix_cycle": 0,
        "deploy_approved": True,
        "needs_deploy_approval": False,
        "invariants": [],
        "invariant_violations": [],
    }


def _resume_deploy_approval_job(
    workflow_id: str, user_id: str, project_id: str, api_keys: dict
) -> None:
    """Resume pipeline from deploy interrupt with deploy_approved=True. Uses checkpoint when available; falls back to hybrid state from workflow store."""
    set_request_id(None)
    final = None
    try:
        from store import get_workflow

        w = get_workflow(workflow_id)
        user_prompt = (w or {}).get("intent", "") if w else ""
        try:
            final = run_pipeline(
                user_prompt,
                user_id,
                project_id,
                workflow_id,
                api_keys,
                checkpoint_id=workflow_id,
                resume_update={"deploy_approved": True, "user_prompt": user_prompt},
            )
        except (KeyError, Exception) as e:
            if "user_prompt" in str(e) or "KeyError" in type(e).__name__:
                hybrid = _build_hybrid_deploy_state(
                    workflow_id, user_id, project_id, api_keys
                )
                if hybrid:
                    logger.info(
                        "[orchestrator] deploy resume: checkpoint failed (%s), using hybrid state from workflow store",
                        e,
                    )
                    final = run_pipeline(
                        hybrid.get("user_prompt", ""),
                        user_id,
                        project_id,
                        workflow_id,
                        api_keys,
                        initial_state=hybrid,
                    )
                else:
                    raise
            else:
                raise

        if final:
            current_stage = final.get("current_stage") or "unknown"
            status = (
                "completed"
                if current_stage in ("deployed", "deploy", "ui_scaffold")
                else (
                    "failed"
                    if current_stage in ("audit_failed", "simulation_failed", "failed")
                    else "building"
                )
            )
            stages = [
                {"stage": "spec", "status": "completed"},
                {
                    "stage": "design",
                    "status": (
                        "completed" if final.get("design_proposal") else "pending"
                    ),
                },
                {
                    "stage": "codegen",
                    "status": "completed" if final.get("contracts") else "pending",
                },
                {
                    "stage": "test_generation",
                    "status": "completed" if final.get("test_files") else "pending",
                },
                {
                    "stage": "audit",
                    "status": (
                        "completed"
                        if final.get("audit_passed")
                        else ("failed" if final.get("audit_findings") else "pending")
                    ),
                },
                {
                    "stage": "guardian",
                    "status": "completed" if final.get("invariants") else "pending",
                },
                {
                    "stage": "deploy",
                    "status": (
                        "completed"
                        if current_stage in ("deployed", "ui_scaffold")
                        else "pending"
                    ),
                },
                {
                    "stage": "simulation",
                    "status": (
                        "completed"
                        if final.get("simulation_passed")
                        else (
                            "failed"
                            if final.get("simulation_results")
                            and not final.get("simulation_passed")
                            else "pending"
                        )
                    ),
                },
                {
                    "stage": "ui_scaffold",
                    "status": "completed" if final.get("ui_schema") else "pending",
                },
            ]
            update_workflow(
                workflow_id=workflow_id,
                status=status,
                current_stage=current_stage,
                stages=stages,
                contracts=final.get("contracts") or {},
                deployments=final.get("deployments") or [],
                test_files=final.get("test_files") or {},
                ui_schema=final.get("ui_schema"),
                error=final.get("error"),
                simulation_passed=final.get("simulation_passed"),
                simulation_results=final.get("simulation_results"),
            )
            if db.is_configured():
                db.update_run(
                    workflow_id,
                    status=_run_status_for_store(status),
                    current_stage=current_stage,
                    error_message=final.get("error"),
                    stages=stages,
                )
    except Exception as e:
        err_msg = str(e)
        logger.exception(
            "[orchestrator] deploy approval resume failed workflow_id=%s", workflow_id
        )
        update_workflow(workflow_id=workflow_id, status="failed", error=err_msg)
        if db.is_configured():
            db.update_run(workflow_id, status="failed", error_message=err_msg)
    finally:
        try:
            api_keys.clear()
        except Exception:
            pass


class DeployApproveBody(BaseModel):
    api_keys: dict[str, str] | None = Field(
        None,
        description="Optional LLM keys for resume; when omitted, uses workspace keys.",
    )


@app.post("/api/v1/workflows/{workflow_id}/deploy/approve")
def deploy_approve_api(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    body: DeployApproveBody = Body(DeployApproveBody()),
    request: Request = None,
) -> dict[str, Any]:
    """Approve deploy after Guardian; resume pipeline to create deploy plans."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    current_stage = w.get("current_stage") or ""
    if current_stage != "awaiting_deploy_approval":
        raise HTTPException(
            status_code=400,
            detail=f"Deploy approval not applicable. Current stage: {current_stage}. Approve only when Guardian passed and stage is awaiting_deploy_approval.",
        )
    user_id = w.get("user_id") or "anonymous"
    project_id = w.get("project_id") or workflow_id
    api_keys = (body.api_keys if body.api_keys else None) or _get_keys_for_run(
        user_id, DEFAULT_WORKSPACE
    )
    if not api_keys:
        raise HTTPException(
            status_code=422,
            detail="LLM API keys required to resume. Add keys in Settings or pass api_keys in request body.",
        )
    background_tasks.add_task(
        _resume_deploy_approval_job, workflow_id, user_id, project_id, dict(api_keys)
    )
    return {
        "workflow_id": workflow_id,
        "status": "resuming",
        "message": "Deploy approved; pipeline resuming.",
    }


@app.post("/api/v1/workflows/{workflow_id}/deploy/complete")
def complete_deploy_api(
    workflow_id: str, body: DeployCompleteBody, request: Request = None
) -> dict[str, Any]:
    """Record deployment from client and persist to workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    deployment = {
        "contract_address": body.contractAddress,
        "transaction_hash": body.transactionHash,
        "deployer_address": body.walletAddress,
        "network": str(w.get("network") or ""),
    }
    if body.abi:
        deployment["abi"] = body.abi
    if body.chainId is not None:
        deployment["chain_id"] = body.chainId
    append_deployment(workflow_id, deployment)
    return {"workflow_id": workflow_id, "accepted": True}


class ClarifyBody(BaseModel):
    message: str = Field("", max_length=5000)


@app.post("/api/v1/workflows/{workflow_id}/clarify")
def clarify_workflow_api(
    workflow_id: str, body: ClarifyBody, request: Request = None
) -> dict[str, Any]:
    """Persist user clarification message on workflow and return updated clarification list."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    from datetime import UTC, datetime

    meta = w.get("metadata") or {}
    clarifications = list(meta.get("clarifications") or [])
    entry = {
        "message": (body.message or "").strip() or "(empty)",
        "at": datetime.now(UTC).isoformat(),
    }
    clarifications.append(entry)
    update_workflow(workflow_id, metadata_merge={"clarifications": clarifications})
    return {
        "workflow_id": workflow_id,
        "accepted": True,
        "clarifications": clarifications,
    }


@app.post("/api/v1/workflows/{workflow_id}/cancel")
def cancel_workflow_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Mark workflow cancelled if still running."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    if w.get("status") == "running" or w.get("status") == "building":
        update_workflow(workflow_id, status="cancelled")
    return {"workflow_id": workflow_id, "status": "cancelled"}


# ---------------------------------------------------------------------------
# Runs (alias for Studio)
# ---------------------------------------------------------------------------


@app.get("/api/v1/runs/{run_id}")
def get_run_api(run_id: str, request: Request = None) -> dict[str, Any]:
    """Return run detail; run_id is workflow_id."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    if request:
        _assert_workflow_owner(w, request)
    return {
        "id": w.get("workflow_id"),
        "workflow_id": w.get("workflow_id"),
        "status": w.get("status"),
        "current_stage": w.get("status"),
        "created_at": w.get("created_at"),
    }


def _has_stub_trace(steps: list[dict]) -> bool:
    """True when any step has stub blob_id (IPFS not configured)."""
    for s in steps:
        bid = s.get("trace_blob_id") or ""
        if isinstance(bid, str) and bid.startswith("stub:"):
            return True
    return False


@app.get("/api/v1/runs/{run_id}/steps")
def get_run_steps_api(run_id: str, request: Request = None) -> dict[str, Any]:
    """Return step-level audit for a run (Phase 1). Empty when Supabase not configured.
    trace_verifiable: false when any step has stub blob_id (IPFS not configured)."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    if request:
        _assert_workflow_owner(w, request)
    steps = db.get_steps(run_id)
    trace_verifiable = not _has_stub_trace(steps)
    return {"run_id": run_id, "steps": steps, "trace_verifiable": trace_verifiable}


@app.get("/api/v1/security/findings")
def get_security_findings_api(
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    run_id: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    """Return security findings for authenticated user's runs. Scoped by wallet_user_id when X-User-Id present."""
    findings = db.list_security_findings(
        wallet_user_id=x_user_id if (x_user_id and x_user_id.strip()) else None,
        run_id=run_id,
        limit=min(200, max(1, limit)),
    )
    return {"findings": findings}


# ---------------------------------------------------------------------------
# Networks, metrics, presets
# ---------------------------------------------------------------------------


@app.get("/api/v1/networks")
def get_networks_api(skale: bool = False) -> list[dict[str, Any]]:
    """Return networks from chain registry. When skale=true, return SKALE Base networks."""
    return get_networks_for_api(skale=skale)


@app.get("/api/v1/networks/rpc-test")
async def rpc_test_api(network_id: str = "", chain_id: int | None = None) -> dict[str, Any]:
    """Test RPC connectivity by calling eth_blockNumber. Pass network_id (slug) or chain_id."""
    cid = chain_id
    if cid is None and network_id:
        cid = get_chain_id_by_network_slug(network_id.strip())
    if cid is None:
        raise HTTPException(status_code=400, detail="Provide network_id or chain_id")
    rpc_explorer = get_chain_rpc_explorer(cid)
    if not rpc_explorer:
        raise HTTPException(status_code=404, detail=f"No RPC URL for chain_id={cid}")
    rpc_url, _ = rpc_explorer
    if not rpc_url:
        raise HTTPException(status_code=404, detail=f"No RPC URL for chain_id={cid}")
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                rpc_url,
                json={"jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 1},
            )
        latency_ms = int((time.perf_counter() - start) * 1000)
        if r.status_code != 200:
            return {"ok": False, "error": f"HTTP {r.status_code}", "latency_ms": latency_ms}
        try:
            j = r.json()
            if j.get("error"):
                return {"ok": False, "error": str(j["error"]), "latency_ms": latency_ms}
            if "result" in j:
                return {"ok": True, "block": j["result"], "latency_ms": latency_ms}
        except Exception as e:
            return {"ok": False, "error": str(e)[:200], "latency_ms": latency_ms}
        return {"ok": False, "error": "Unexpected response", "latency_ms": latency_ms}
    except httpx.TimeoutException:
        return {"ok": False, "error": "Request timed out", "latency_ms": int((time.perf_counter() - start) * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], "latency_ms": int((time.perf_counter() - start) * 1000)}


@app.get("/api/v1/tokens/stablecoins")
def get_stablecoins_api() -> dict[str, dict[str, str]]:
    """Return USDC/USDT addresses per chain from x402/stablecoins.yaml. Keys are chain IDs as strings."""
    return get_stablecoins_by_chain()


@app.get("/api/v1/platform/track-record")
def get_platform_track_record_api() -> dict[str, Any]:
    """Return platform track record stats for login page. Public, no auth.
    All metrics from DB when configured: audits (run_steps), vulnerabilities (security_findings),
    security_researchers (distinct users with completed audits), contracts_deployed (deployments table).
    Uses real DB values (including 0) when configured; env fallbacks only when DB not configured.
    """
    audits = int(os.environ.get("PLATFORM_AUDITS_COMPLETED", "0"))
    vulnerabilities = int(os.environ.get("PLATFORM_VULNERABILITIES_FOUND", "0"))
    researchers = int(os.environ.get("PLATFORM_SECURITY_RESEARCHERS", "0"))
    contracts_deployed = int(os.environ.get("PLATFORM_CONTRACTS_DEPLOYED", "0"))
    source = "env_defaults"

    if db.is_configured():
        try:
            audit_count = db.count_completed_audits()
            findings_count = db.count_security_findings()
            researchers_count = db.count_distinct_auditors()
            deployments_count = db.count_deployments()

            # Use real DB values for all metrics (including 0)
            audits = audit_count
            vulnerabilities = findings_count
            researchers = researchers_count
            contracts_deployed = deployments_count
            source = "database"

            # Legacy: if run_steps/security_findings empty, try workflow_state
            if audit_count == 0 and findings_count == 0:
                states = db.list_workflow_states(limit=500)
                if states:
                    audit_count_legacy = sum(
                        1 for s in states
                        if any(
                            st.get("stage") == "audit" and st.get("status") == "completed"
                            for st in (s.get("stages") or [])
                        )
                    )
                    total_findings = sum(len(s.get("audit_findings") or []) for s in states)
                    if audit_count_legacy > 0:
                        audits = audit_count_legacy
                    if total_findings > 0:
                        vulnerabilities = total_findings
        except Exception:
            pass

    return {
        "audits_completed": audits,
        "vulnerabilities_found": vulnerabilities,
        "security_researchers": researchers,
        "contracts_deployed": contracts_deployed,
        "source": source,
    }


AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001").rstrip(
    "/"
)
VECTORDB_URL = os.environ.get("VECTORDB_URL", "http://localhost:8010").rstrip("/")
INTEGRATIONS_TIMEOUT = float(os.environ.get("INTEGRATIONS_TIMEOUT", "15.0"))


SIMULATION_SERVICE_URL = os.environ.get(
    "SIMULATION_SERVICE_URL", "http://localhost:8002"
).rstrip("/")
STORAGE_SERVICE_URL = os.environ.get(
    "STORAGE_SERVICE_URL", "http://localhost:4005"
).rstrip("/")


async def _fetch_integrations() -> dict[str, bool]:
    """Fetch integration status from simulation, storage, agent-runtime, vectordb health endpoints.
    In production (Contabo/Coolify), services may cold-start (30-60s); use INTEGRATIONS_TIMEOUT env (default 15s).
    """
    tenderly = False
    pinata = False
    qdrant = False
    async with httpx.AsyncClient(timeout=INTEGRATIONS_TIMEOUT) as client:
        try:
            r = await client.get(f"{SIMULATION_SERVICE_URL}/health")
            if r.status_code == 200:
                data = r.json()
                tenderly = data.get("tenderly_configured", False)
                logger.debug("[integrations] simulation ok tenderly=%s", tenderly)
            else:
                logger.warning(
                    "[integrations] simulation health %s: %s",
                    r.status_code,
                    r.text[:200],
                )
        except Exception as e:
            logger.warning(
                "[integrations] simulation unreachable url=%s: %s",
                SIMULATION_SERVICE_URL,
                e,
            )
        try:
            r = await client.get(f"{STORAGE_SERVICE_URL}/health")
            if r.status_code == 200:
                data = r.json()
                pinata = data.get("pinata_configured", False)
                logger.debug("[integrations] storage ok pinata=%s", pinata)
            else:
                logger.warning(
                    "[integrations] storage health %s: %s",
                    r.status_code,
                    r.text[:200],
                )
        except Exception as e:
            logger.warning(
                "[integrations] storage unreachable url=%s: %s",
                STORAGE_SERVICE_URL,
                e,
            )
        try:
            r = await client.get(f"{AGENT_RUNTIME_URL}/health")
            if r.status_code == 200:
                logger.debug("[integrations] agent-runtime ok")
            else:
                logger.warning(
                    "[integrations] agent-runtime health %s: %s",
                    r.status_code,
                    r.text[:200],
                )
        except Exception as e:
            logger.warning(
                "[integrations] agent-runtime unreachable url=%s: %s",
                AGENT_RUNTIME_URL,
                e,
            )
        try:
            r = await client.get(f"{VECTORDB_URL}/health")
            if r.status_code == 200:
                data = r.json()
                qdrant = data.get("qdrant_configured", False)
                logger.debug("[integrations] vectordb ok qdrant=%s", qdrant)
            else:
                logger.warning(
                    "[integrations] vectordb health %s: %s", r.status_code, r.text[:200]
                )
        except Exception as e:
            logger.warning(
                "[integrations] vectordb unreachable url=%s: %s", VECTORDB_URL, e
            )
    return {
        "tenderly_configured": tenderly,
        "pinata_configured": pinata,
        "qdrant_configured": qdrant,
    }


@app.get("/api/v1/config/integrations-debug")
async def get_integrations_debug_api() -> dict[str, Any]:
    """Debug endpoint: raw integration health. Use to diagnose Settings > Integrations 'Not configured'.
    Checks: AGENT_RUNTIME_URL/health (tenderly, pinata), VECTORDB_URL/health (qdrant).
    """
    integrations = await _fetch_integrations()
    networks = get_networks_for_api()
    return {
        "agent_runtime_url": AGENT_RUNTIME_URL,
        "simulation_url": SIMULATION_SERVICE_URL,
        "storage_url": STORAGE_SERVICE_URL,
        "vectordb_url": VECTORDB_URL,
        "integrations_timeout": INTEGRATIONS_TIMEOUT,
        "integrations": integrations,
        "networks_count": len(networks),
        "hint": "Tenderly: TENDERLY_API_KEY on simulation service. Pinata: PINATA_JWT on storage service. Qdrant: QDRANT_URL on vectordb.",
    }


@app.get("/api/v1/config")
async def get_config_api() -> dict[str, Any]:
    """Return public runtime config (x402, monitoring, payment, integrations, A2A identity) from registries. No auth required for Studio bootstrap."""
    merchant = os.environ.get("MERCHANT_WALLET_ADDRESS", "").strip()
    integrations = await _fetch_integrations()
    a2a_identity = get_erc8004_agent_identity()
    return {
        "x402_enabled": get_x402_enabled(),
        "monitoring_enabled": get_monitoring_enabled(),
        "merchant_wallet_address": merchant or None,
        "credits_enabled": credits_supabase.is_configured(),
        "credits_per_usd": CREDITS_PER_USD,
        "credits_per_run": CREDITS_PER_RUN,
        "default_network_id": ANCHOR_NETWORK_SLUG,
        "default_chain_id": get_default_chain_id(),
        "a2a_agent_id": get_a2a_agent_id(),
        "a2a_default_chain_id": get_a2a_default_chain_id(),
        "a2a_identity": a2a_identity,
        "integrations": integrations,
    }


@app.get("/api/v1/pricing/plans")
def pricing_plans_api() -> dict[str, Any]:
    """Return available subscription plans from x402-products.yaml."""
    plans = get_x402_plans()
    return {"plans": plans}


@app.get("/api/v1/pricing/plans/{plan_id}")
def pricing_plan_detail_api(plan_id: str) -> dict[str, Any]:
    """Return a single plan by id."""
    plan = get_x402_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_id}' not found")
    return plan


@app.get("/api/v1/pricing/resources")
def pricing_resources_api() -> dict[str, Any]:
    """Return x402 billable resources with unit prices."""
    resources = get_x402_resources()
    for r in resources:
        r["unit_price"] = get_resource_price(r.get("id", ""))
    return {"resources": resources}


@app.get("/api/v1/pricing/usage")
def pricing_usage_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return current usage vs plan limits for the authenticated user."""
    if not x_user_id:
        return {"plan": "free", "usage": {}, "limits": {}}
    plan_id = "free"
    if db.is_configured():
        try:
            client = db._client()
            if client:
                r = (
                    client.table("wallet_users")
                    .select("plan_id")
                    .eq("id", x_user_id)
                    .maybe_single()
                    .execute()
                )
                if r and r.data:
                    plan_id = r.data.get("plan_id") or "free"
        except Exception:
            pass
    plan = get_x402_plan(plan_id) or get_x402_plan("free") or {}
    limits = plan.get("limits") or {}
    run_count = count_workflows()
    usage = {"pipeline.run": run_count}
    return {
        "plan": plan_id,
        "plan_name": plan.get("name", plan_id),
        "usage": usage,
        "limits": limits,
        "features": plan.get("features", []),
        "enabled_pipelines": plan.get("enabledPipelines", []),
    }


def _metrics_since_from_time_range(time_range: str) -> str | None:
    """Return ISO datetime string for filtering, or None for all time."""
    if not time_range or time_range == "all":
        return None
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    if time_range == "7d":
        since = now - timedelta(days=7)
    elif time_range == "30d":
        since = now - timedelta(days=30)
    elif time_range == "90d":
        since = now - timedelta(days=90)
    else:
        return None
    return since.isoformat()


@app.get("/api/v1/metrics")
def get_metrics_api(time_range: str = "all") -> dict[str, Any]:
    """Return basic metrics for Studio dashboard. Counts from runs table when Supabase is configured. time_range: 7d, 30d, 90d, all."""
    total = count_workflows()
    active = 0
    completed = 0
    failed = 0
    since = _metrics_since_from_time_range(time_range or "all")
    if db.is_configured():
        try:
            client = db._client()
            if client:
                for status_val, counter_name in [
                    ("running", "active"),
                    ("success", "completed"),
                    ("failed", "failed"),
                ]:
                    q = client.table("runs").select("id", count="exact").eq("status", status_val)
                    if since:
                        q = q.gte("created_at", since)
                    r = q.execute()
                    cnt = int(getattr(r, "count", 0) or 0)
                    if counter_name == "active":
                        active = cnt
                    elif counter_name == "completed":
                        completed = cnt
                    else:
                        failed = cnt
        except Exception as e:
            logger.warning("[metrics] count by status failed: %s", e)
            completed = total
    else:
        completed = total
    if since:
        total = active + completed + failed
    return {
        "workflows": {
            "total": total,
            "active": active,
            "completed": completed,
            "failed": failed,
        },
        "total_workflows": total,
    }


@app.get("/api/v1/presets")
def get_presets_api() -> list[dict[str, Any]]:
    """Return presets from token template registry."""
    return [
        {
            "id": t["id"],
            "name": t.get("name", t["id"]),
            "description": t.get("description", ""),
        }
        for t in get_templates_for_api()
    ]


@app.get("/api/v1/blueprints")
def get_blueprints_api() -> list[dict[str, Any]]:
    """Return blueprints from token template registry; same source as presets."""
    return [
        {
            "id": t["id"],
            "name": t.get("name", t["id"]),
            "description": t.get("description", ""),
        }
        for t in get_templates_for_api()
    ]


# ---------------------------------------------------------------------------
# BYOK workspace LLM keys
# ---------------------------------------------------------------------------


class LLMKeysBody(BaseModel):
    keys: dict[str, str] = Field(default_factory=dict)


def _require_user_id_for_byok(x_user_id: str | None) -> None:
    """Raise 401 when Supabase BYOK is configured but X-User-Id is missing."""
    if llm_keys_supabase._is_configured() and not (x_user_id and x_user_id.strip()):
        raise HTTPException(
            status_code=401,
            detail="X-User-Id required when BYOK persistence is configured",
        )


def _trace_llm_keys(
    request: Request,
    method: str,
    x_user_id: str | None,
    x_workspace_id: str | None,
    outcome: str,
    provider_count: int | None = None,
) -> None:
    """Structured trace for llm-keys requests; correlate with gateway auth logs via x-request-id."""
    request_id = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    )
    payload = {
        "trace": "llm_keys",
        "method": method,
        "path": "/api/v1/workspaces/current/llm-keys",
        "request_id": request_id,
        "has_x_user_id": bool(x_user_id and str(x_user_id).strip()),
        "x_workspace_id": (x_workspace_id or "").strip() or None,
        "byok_configured": llm_keys_supabase._is_configured(),
        "outcome": outcome,
    }
    if provider_count is not None:
        payload["configured_providers_count"] = provider_count
    logger.warning("[llm-keys] %s", json.dumps(payload))


@app.get("/api/v1/workspaces/current/llm-keys")
def get_llm_keys(
    request: Request,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return configured provider names only (no key values). Uses Supabase by user_id when present and configured, else in-memory by workspace."""
    _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(
            request, "GET", x_user_id, x_workspace_id, "401_missing_x_user_id"
        )
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        db.ensure_wallet_user_profile(x_user_id)
        _log_byok_event("byok_access", x_user_id, "get_configured_providers")
        providers = llm_keys_supabase.get_configured_providers(x_user_id)
        _trace_llm_keys(
            request,
            "GET",
            x_user_id,
            x_workspace_id,
            "success",
            provider_count=len(providers),
        )
        return {"configured_providers": providers}
    if llm_keys_supabase._is_configured():
        return {"configured_providers": []}
    providers = get_configured_providers(wid)
    _trace_llm_keys(
        request,
        "GET",
        x_user_id,
        x_workspace_id,
        "success",
        provider_count=len(providers),
    )
    return {"configured_providers": providers}


@app.post("/api/v1/workspaces/current/llm-keys")
def post_llm_keys(
    request: Request,
    body: LLMKeysBody,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Store LLM keys for current workspace or user. Uses Supabase when X-User-Id present and configured."""
    _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(
            request, "POST", x_user_id, x_workspace_id, "401_missing_x_user_id"
        )
        raise
    # Production: require encryption (Fernet or KMS) for BYOK persistence.
    if os.environ.get("ENV") == "production" and not (
        os.environ.get("LLM_KEY_ENCRYPTION_KEY")
        or os.environ.get("LLM_KEY_KMS_KEY_ARN")
    ):
        if x_user_id and (body.keys or {}):
            _trace_llm_keys(
                request, "POST", x_user_id, x_workspace_id, "503_missing_encryption_key"
            )
            raise HTTPException(
                status_code=503,
                detail="BYOK requires LLM_KEY_ENCRYPTION_KEY or LLM_KEY_KMS_KEY_ARN in production",
            )
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        db.ensure_wallet_user_profile(x_user_id)
        _log_byok_event("byok_access", x_user_id, "set_keys")
        providers = llm_keys_supabase.set_keys_for_user(x_user_id, body.keys or {})
        if body.keys and not providers:
            _trace_llm_keys(
                request,
                "POST",
                x_user_id,
                x_workspace_id,
                "error_storage",
                provider_count=0,
            )
            raise HTTPException(
                status_code=503,
                detail="BYOK storage failed. Check LLM_KEY_ENCRYPTION_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY.",
            )
        _trace_llm_keys(
            request,
            "POST",
            x_user_id,
            x_workspace_id,
            "success",
            provider_count=len(providers),
        )
        return {"configured_providers": providers}
    if llm_keys_supabase._is_configured():
        raise HTTPException(
            status_code=503,
            detail="BYOK persistence is configured; sign in and use the gateway so X-User-Id is set.",
        )
    providers = set_keys(wid, body.keys or {})
    _trace_llm_keys(
        request,
        "POST",
        x_user_id,
        x_workspace_id,
        "success",
        provider_count=len(providers),
    )
    return {"configured_providers": providers}


@app.delete("/api/v1/workspaces/current/llm-keys")
def delete_llm_keys(
    request: Request,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Remove all LLM keys for current workspace or user. Uses Supabase when X-User-Id present and configured."""
    _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(
            request, "DELETE", x_user_id, x_workspace_id, "401_missing_x_user_id"
        )
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        db.ensure_wallet_user_profile(x_user_id)
        _log_byok_event("byok_access", x_user_id, "delete_keys")
        ok = llm_keys_supabase.delete_keys_for_user(x_user_id)
        if not ok:
            _trace_llm_keys(
                request, "DELETE", x_user_id, x_workspace_id, "error_no_row_updated"
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to clear LLM keys. No matching user found. Sign out and sign in again, then try Remove all keys.",
            )
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
        return {"success": True}
    if llm_keys_supabase._is_configured():
        _trace_llm_keys(
            request, "DELETE", x_user_id, x_workspace_id, "skipped_no_user_id"
        )
        return {"success": True}
    delete_keys(wid)
    _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
    return {"success": True}


class LLMKeyValidateBody(BaseModel):
    provider: str = Field(..., min_length=1, max_length=64)
    api_key: str | None = Field(None, max_length=512)


async def _validate_llm_key_provider(provider: str, api_key: str) -> tuple[bool, int | None, str | None]:
    """Validate API key by calling provider models endpoint. Returns (valid, latency_ms, error)."""
    provider = provider.strip().lower()
    key = (api_key or "").strip()
    if not key:
        return False, None, "No API key provided"
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if provider == "openai":
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
            elif provider == "anthropic":
                r = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                )
            elif provider == "google":
                r = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
                )
            elif provider == "together":
                r = await client.get(
                    "https://api.together.xyz/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                )
            else:
                return False, None, f"Unknown provider: {provider}"
            latency_ms = int((time.perf_counter() - start) * 1000)
            if r.status_code in (200, 201):
                return True, latency_ms, None
            err_body = r.text[:200] if r.text else ""
            try:
                j = r.json()
                msg = (j.get("error") or {}).get("message") or (j.get("error") or {}).get("message") or str(j.get("message", ""))
                if msg:
                    err_body = msg[:200]
            except Exception:
                pass
            return False, latency_ms, err_body or f"HTTP {r.status_code}"
    except httpx.TimeoutException:
        return False, int((time.perf_counter() - start) * 1000), "Request timed out"
    except Exception as e:
        return False, int((time.perf_counter() - start) * 1000), str(e)[:200]


@app.post("/api/v1/workspaces/current/llm-keys/validate")
async def validate_llm_key(
    body: LLMKeyValidateBody,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Validate an LLM API key by calling the provider's models endpoint. Use api_key in body for form input, or omit to test stored key (requires auth)."""
    api_key = (body.api_key or "").strip()
    if not api_key:
        _require_user_id_for_byok(x_user_id)
        wid = x_workspace_id or DEFAULT_WORKSPACE
        stored = {}
        if x_user_id and llm_keys_supabase._is_configured():
            stored = llm_keys_supabase.get_keys_for_user(x_user_id) or {}
        else:
            stored = get_keys_for_pipeline(wid) or {}
        api_key = (stored or {}).get(body.provider.strip().lower(), "")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="No API key in request and no stored key for this provider. Enter a key to validate.",
            )
    valid, latency_ms, err = await _validate_llm_key_provider(body.provider, api_key)
    out: dict[str, Any] = {"valid": valid}
    if latency_ms is not None:
        out["latency_ms"] = latency_ms
    if err and not valid:
        out["error"] = err
    return out


# ---------------------------------------------------------------------------
# Templates (Studio)
# ---------------------------------------------------------------------------


@app.get("/api/v1/templates")
def get_templates_api() -> list[dict[str, Any]]:
    """Return templates from token registry (source, codegen_mode, risk_profile)."""
    return get_templates_for_api()


@app.get("/api/v1/templates/search")
def search_templates_api(q: str = "") -> list[dict[str, Any]]:
    """Search templates by query."""
    all_t = get_templates_for_api()
    if not q or not q.strip():
        return all_t
    ql = q.lower()
    return [
        t
        for t in all_t
        if ql in (t.get("name") or "").lower() or ql in (t.get("id") or "").lower()
    ]


# ---------------------------------------------------------------------------
# x402 Payments and spending controls (Supabase-backed)
# ---------------------------------------------------------------------------


@app.get("/api/v1/payments/history")
def payments_history_api(
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """Return payment history for the authenticated user (X-User-Id = wallet_users.id)."""
    if not x_user_id:
        return {"items": [], "total": 0, "message": "X-User-Id required"}
    if not payments_supabase.is_configured():
        return {"items": [], "total": 0}
    items, total = payments_supabase.get_payment_history(
        x_user_id, limit=min(100, max(1, limit)), offset=max(0, offset)
    )
    return {"items": items, "total": total}


@app.get("/api/v1/payments/summary")
def payments_summary_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return payment summary (total spent, count) for the authenticated user."""
    if not x_user_id:
        return {"total": "0", "currency": "USD", "total_count": 0}
    if not payments_supabase.is_configured():
        return {"total": "0", "currency": "USD", "total_count": 0}
    return payments_supabase.get_payment_summary(x_user_id)


def _spending_control_default() -> dict[str, Any]:
    return {
        "budget": "0",
        "currency": "USD",
        "period": "monthly",
        "alert_threshold_percent": 80,
        "spent": "0",
    }


@app.get("/api/v1/payments/spending-control")
def payments_spending_control_get_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return spending control (budget, period, alert) for the authenticated user. Never 500; returns defaults on error."""
    try:
        if not x_user_id:
            return _spending_control_default()
        if not payments_supabase.is_configured():
            return _spending_control_default()
        row = payments_supabase.get_spending_control(x_user_id)
        if not row:
            return _spending_control_default()
        spent = "0"
        try:
            summary = payments_supabase.get_payment_summary(x_user_id)
            spent = str(summary.get("total", "0") or "0")
        except Exception:
            pass
        return {
            "budget": str(row.get("budget_amount", 0) or 0),
            "currency": row.get("budget_currency") or "USD",
            "period": row.get("period") or "monthly",
            "alert_threshold_percent": int(
                row.get("alert_threshold_percent", 80) or 80
            ),
            "spent": spent,
        }
    except Exception as e:
        logger.warning("[payments] spending-control GET error: %s", e, exc_info=True)
        return _spending_control_default()


class SpendingControlBody(BaseModel):
    budget_amount: float = Field(ge=0, description="Budget amount per period")
    budget_currency: str = "USD"
    period: str = "monthly"
    alert_threshold_percent: int = Field(ge=0, le=100, default=80)


@app.patch("/api/v1/payments/spending-control")
def payments_spending_control_patch_api(
    body: SpendingControlBody,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Update spending control for the authenticated user."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    if not payments_supabase.is_configured():
        raise HTTPException(status_code=503, detail="Spending controls not configured")
    period = body.period if body.period in ("daily", "weekly", "monthly") else "monthly"
    for api_attempt in range(3):
        row = payments_supabase.upsert_spending_control(
            x_user_id,
            budget_amount=body.budget_amount,
            budget_currency=body.budget_currency or "USD",
            period=period,
            alert_threshold_percent=body.alert_threshold_percent,
        )
        if row:
            break
        if api_attempt < 2:
            time.sleep(0.2 * (api_attempt + 1))
    if not row:
        raise HTTPException(status_code=500, detail="Failed to update spending control")
    return {
        "budget": str(row.get("budget_amount", 0)),
        "currency": row.get("budget_currency") or "USD",
        "period": row.get("period") or "monthly",
        "alert_threshold_percent": row.get("alert_threshold_percent", 80),
    }


# ---------------------------------------------------------------------------
# Credits (top-up off-chain; consume per workflow run; x402 for external pay-per-call)
# ---------------------------------------------------------------------------


@app.get("/api/v1/credits/balance")
def credits_balance_api(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return current credit balance for the authenticated user. Used for workflow runs and agent actions."""
    if not x_user_id:
        return {"balance": 0.0, "currency": "USD", "message": "X-User-Id required"}
    return credits_supabase.get_balance(x_user_id)


class CreditsTopUpBody(BaseModel):
    amount: float = Field(
        gt=0, description="Credit amount to add (e.g. fiat/USDC/USDT conversion)"
    )
    currency: str = "USD"
    reference_id: str | None = None
    reference_type: str | None = "manual"


@app.post("/api/v1/credits/top-up")
def credits_top_up_api(
    body: CreditsTopUpBody,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Record a credit top-up (e.g. after Stripe/fiat or USDC/USDT). Idempotency via reference_id recommended.
    When amount is in USD (usdc_transfer, fiat), it is multiplied by CREDITS_PER_USD to get credits.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    if not credits_supabase.is_configured():
        raise HTTPException(status_code=503, detail="Credits not configured")
    is_usd_input = (body.reference_type or "").lower() in (
        "usdc_transfer",
        "usdt_transfer",
        "fiat",
    ) or (body.currency or "").upper() == "USD"
    credits_to_add = body.amount * CREDITS_PER_USD if is_usd_input else body.amount
    result = credits_supabase.top_up(
        x_user_id,
        amount=credits_to_add,
        currency=body.currency or "USD",
        reference_id=body.reference_id,
        reference_type=body.reference_type or "manual",
        metadata=(
            {"usd_amount": body.amount, "credits_per_usd": CREDITS_PER_USD}
            if is_usd_input
            else None
        ),
    )
    if not result:
        raise HTTPException(status_code=500, detail="Top-up failed")
    return {
        "balance": result["balance"],
        "currency": result["currency"],
        "user_id": result["user_id"],
    }


@app.get("/api/v1/logs")
def logs_api(page: int = 1, page_size: int = 50) -> dict[str, Any]:
    """Recent activity from run_steps. Returns empty list when Supabase not configured or on error (no 5xx)."""
    try:
        logs = db.get_recent_activity_logs(limit=min(page_size * 2, 100))
        total = len(logs)
        start = (page - 1) * page_size
        end = start + page_size
        page_logs = logs[start:end] if total else []
        return {"logs": page_logs, "total": total, "page": page, "page_size": page_size}
    except Exception:
        return {"logs": [], "total": 0, "page": 1, "page_size": page_size}


@app.get("/api/v1/logs/services")
def logs_services_api() -> list[str]:
    """Return distinct service names from recent activity; empty when not configured."""
    try:
        logs = db.get_recent_activity_logs(limit=100)
        services = sorted(
            {str(e.get("service", "orchestrator")) for e in logs if e.get("service")}
        )
        return services if services else ["orchestrator"]
    except Exception:
        return ["orchestrator"]


@app.get("/api/v1/logs/hosts")
def logs_hosts_api() -> list[str]:
    """Return distinct log sources: service names from run_steps and agent_logs, plus ORCHESTRATOR_HOST if set."""
    try:
        entries = db.get_recent_activity_logs(limit=200)
        hosts = sorted({str(e.get("service", "")) for e in entries if e.get("service")})
        out = [h for h in hosts if h]
        env_host = (os.environ.get("ORCHESTRATOR_HOST") or "").strip()
        if env_host and env_host not in out:
            out.insert(0, env_host)
        return out
    except Exception:
        return (
            ["orchestrator"]
            if (os.environ.get("ORCHESTRATOR_HOST") or "").strip()
            else []
        )


@app.get("/api/v1/agents")
def agents_api() -> dict[str, Any]:
    """Return pipeline agents from workflow (spec, design, codegen, audit, simulation, deploy, ui_scaffold)."""
    from nodes import STEP_ORDER

    return {
        "agents": [
            {"name": name, "status": "ok", "step_index": i}
            for i, name in enumerate(STEP_ORDER)
        ]
    }


# ---------------------------------------------------------------------------
# Contract read/call
# ---------------------------------------------------------------------------


class ContractReadBody(BaseModel):
    contract_address: str = ""
    network: str = ""
    chain_id: int | None = None
    function_name: str = ""
    function_args: list[Any] = Field(default_factory=list)
    abi: list[Any] = Field(default_factory=list)


class ContractCallBody(BaseModel):
    contract_address: str = ""
    network: str = ""
    chain_id: int | None = None
    function_name: str = ""
    function_args: list[Any] = Field(default_factory=list)
    caller_address: str | None = None
    value: str = "0"
    gas_limit: int | None = None
    abi: list[Any] = Field(default_factory=list)


@app.post("/api/v1/contracts/read")
def contract_read_api(body: ContractReadBody) -> dict[str, Any]:
    """Contract read (view/pure) via chain RPC. Requires chain_id or network and abi."""
    if not body.contract_address or not body.function_name:
        return {
            "success": False,
            "error": "contract_address and function_name required",
        }
    if not body.abi:
        return {"success": False, "error": "abi required for contract read"}
    chain_id = body.chain_id
    if chain_id is None and body.network:
        chain_id = get_chain_id_by_network_slug(body.network)
    if chain_id is None:
        return {"success": False, "error": "chain_id or network (slug) required"}
    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer:
        return {"success": False, "error": f"RPC not found for chain_id={chain_id}"}
    rpc_url, _ = rpc_explorer
    from contract_rpc import contract_read

    ok, result, err = contract_read(
        rpc_url,
        body.contract_address,
        body.abi,
        body.function_name,
        body.function_args or [],
    )
    if not ok:
        return {"success": False, "error": err or "RPC call failed"}
    return {"success": True, "result": result}


@app.post("/api/v1/contracts/call")
def contract_call_api(body: ContractCallBody) -> dict[str, Any]:
    """Build unsigned transaction for contract write; client signs and submits."""
    if not body.contract_address or not body.function_name:
        return {
            "success": False,
            "error": "contract_address and function_name required",
        }
    abi = body.abi or []
    if not abi:
        return {"success": False, "error": "abi required for contract call"}
    chain_id = body.chain_id
    if chain_id is None and body.network:
        chain_id = get_chain_id_by_network_slug(body.network)
    if chain_id is None:
        return {"success": False, "error": "chain_id or network (slug) required"}
    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer:
        return {"success": False, "error": f"RPC not found for chain_id={chain_id}"}
    rpc_url, _ = rpc_explorer
    from contract_rpc import contract_call_build_tx

    ok, tx, err = contract_call_build_tx(
        rpc_url,
        body.contract_address,
        abi,
        body.function_name,
        body.function_args or [],
        value=body.value or "0",
        gas_limit=body.gas_limit,
        caller_address=body.caller_address,
        chain_id=chain_id,
    )
    if not ok:
        return {"success": False, "error": err or "Build tx failed"}
    return {
        "success": True,
        "transaction": tx,
        "message": "Sign and send with your wallet",
    }


# ---------------------------------------------------------------------------
# Legacy /run removed (was 410 Gone). Use POST /api/v1/workflows/generate.
# ---------------------------------------------------------------------------


def _approve_spec_impl(run_id: str, request: Request | None = None) -> dict[str, Any]:
    """Set spec_approved and resume pipeline from design node."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    if not w.get("spec"):
        raise HTTPException(
            status_code=400, detail="No spec to approve; run must be at spec_review"
        )
    update_workflow(run_id, spec_approved=True)
    user_id = w.get("user_id") or "anonymous"
    project_id = w.get("project_id") or run_id
    api_keys = _get_keys_for_run(user_id, DEFAULT_WORKSPACE)
    agent_session_jwt = _create_agent_session_jwt_if_configured(
        user_id, run_id, api_keys
    )
    initial_state = {
        "user_prompt": w.get("intent", ""),
        "user_id": user_id,
        "project_id": project_id,
        "run_id": run_id,
        "pipeline_id": DEFAULT_PIPELINE_ID,
        "api_keys": api_keys or {},
        "agent_session_jwt": agent_session_jwt or "",
        "template_id": w.get("template_id") or "",
        "use_oz_wizard": False,
        "oz_wizard_options": w.get("oz_wizard_options") or {},
        "spec": w["spec"],
        "spec_approved": True,
        "design_proposal": {},
        "design_approved": False,
        "contracts": {},
        "framework": "hardhat",
        "audit_findings": [],
        "audit_passed": False,
        "simulation_results": {},
        "simulation_passed": False,
        "deployments": [],
        "ui_schema": {},
        "messages": [],
        "current_stage": "design",
        "error": None,
        "needs_human_approval": False,
    }
    try:
        final = run_pipeline(
            w.get("intent", ""),
            user_id,
            project_id,
            run_id,
            api_keys,
            initial_state=initial_state,
        )
        stage = final.get("current_stage", "unknown")
        status = "completed" if stage in ("deployed", "ui_scaffold") else "building"
        update_workflow(
            run_id,
            status=status,
            simulation_passed=final.get("simulation_passed"),
            simulation_results=final.get("simulation_results"),
            audit_findings=final.get("audit_findings"),
        )
        if db.is_configured():
            db.update_run(
                run_id, status=_run_status_for_store(status), current_stage=stage
            )
        return {
            "run_id": run_id,
            "status": status,
            "current_stage": stage,
            "message": "Resumed from design",
        }
    except Exception as e:
        update_workflow(run_id, status="failed", error=str(e))
        if db.is_configured():
            db.update_run(run_id, status="failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/runs/{run_id}/approve_spec")
def approve_spec_legacy(run_id: str, request: Request = None) -> dict[str, Any]:
    """Legacy path. Use PATCH /api/v1/runs/{run_id}/approve_spec."""
    return _approve_spec_impl(run_id, request)


@app.patch("/api/v1/runs/{run_id}/approve_spec")
def approve_spec(run_id: str, request: Request = None) -> dict[str, Any]:
    """Set spec_approved and resume pipeline from design node."""
    return _approve_spec_impl(run_id, request)


TOOLS_BASE_URL = (os.environ.get("TOOLS_BASE_URL") or "").rstrip("/")


def _check_tools_health() -> dict[str, Any]:
    """Ping hyperagent-tools /health when TOOLS_BASE_URL is set."""
    if not TOOLS_BASE_URL:
        return {"status": "not_configured", "url": None}
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{TOOLS_BASE_URL}/health")
            if r.status_code == 200:
                return {"status": "ok", "url": TOOLS_BASE_URL}
            return {"status": "error", "url": TOOLS_BASE_URL, "code": r.status_code}
    except Exception as e:
        return {"status": "offline", "url": TOOLS_BASE_URL, "error": str(e)}


# Quick-demo sandbox: Contabo Docker Sandbox API
SANDBOX_API_URL = (
    os.environ.get("SANDBOX_API_URL") or os.environ.get("OPENSANDBOX_API_URL") or ""
).rstrip("/")
SANDBOX_API_KEY = (
    os.environ.get("SANDBOX_API_KEY", "").strip()
    or os.environ.get("OPENSANDBOX_API_KEY", "").strip()
)


class QuickDemoBody(BaseModel):
    """Optional body for quick-demo. When workflow_id is set, use generated code as sandbox source."""

    workflow_id: str | None = None


async def _quick_demo_via_docker_sandbox(
    tarball_url: str,
    timeout_minutes: int = 30,
) -> dict[str, Any]:
    """Create sandbox via Contabo Docker Sandbox API (SANDBOX_API_URL)."""
    if not SANDBOX_API_URL or not SANDBOX_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Docker sandbox not configured: set SANDBOX_API_URL (or OPENSANDBOX_API_URL) and OPENSANDBOX_API_KEY",
        )
    create_url = f"{SANDBOX_API_URL}/sandbox/create"
    payload = {
        "tarball_url": tarball_url,
        "timeout_minutes": timeout_minutes,
        "port": 8545,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            create_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {SANDBOX_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        if r.status_code != 200:
            detail = (r.text[:500] or str(r.status_code)).strip()
            raise HTTPException(
                status_code=502,
                detail=f"sandbox_api_status={r.status_code}, body={detail}",
            )
        data = r.json()
        return {
            "sandbox_id": data.get("sandbox_id"),
            "url": data.get("url"),
            "status": data.get("status", "running"),
        }


@app.post("/api/v1/quick-demo")
async def quick_demo_api(
    request: Request, body: QuickDemoBody | None = None
) -> dict[str, Any]:
    """Create a sandbox from workflow-generated code via Contabo Docker Sandbox API.
    Requires workflow_id in body. Returns sandbox URL for Try it Now."""
    workflow_id = (body and body.workflow_id) or None
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id required in body")
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    base = (os.environ.get("ORCHESTRATOR_PUBLIC_URL") or str(request.base_url)).rstrip(
        "/"
    )
    tarball_url = f"{base}/api/v1/workflows/{workflow_id}/tarball"
    return await _quick_demo_via_docker_sandbox(tarball_url=tarball_url)


@app.post("/api/v1/workflows/{workflow_id}/debug-sandbox")
async def debug_sandbox_api(workflow_id: str, request: Request) -> dict[str, Any]:
    """Create a sandbox pre-loaded with the workflow's generated code and failing audit.
    Use when audit fails so user can fix in a browser-based IDE. Uses Contabo Docker Sandbox API.
    """
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    _assert_workflow_owner(w, request)
    base = (os.environ.get("ORCHESTRATOR_PUBLIC_URL") or str(request.base_url)).rstrip(
        "/"
    )
    tarball_url = f"{base}/api/v1/workflows/{workflow_id}/tarball"
    out = await _quick_demo_via_docker_sandbox(tarball_url=tarball_url)
    out["workflow_id"] = workflow_id
    return out


@app.get("/health")
def health() -> dict[str, Any]:
    """Health and registry versions."""
    versions = get_registry_versions()
    return {"status": "ok", "registries": versions}


def _check_supabase_health() -> dict[str, Any]:
    """Ping Supabase when configured."""
    if not db.is_configured():
        return {"status": "not_configured"}
    try:
        client = db._client()
        if client:
            client.table("runs").select("id").limit(1).execute()
            return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}
    return {"status": "not_configured"}


def _check_redis_health() -> dict[str, Any]:
    """Ping Redis when REDIS_URL is set."""
    url = (os.environ.get("REDIS_URL") or "").strip()
    if not url or url.startswith("#"):
        return {"status": "not_configured"}
    try:
        from redis import Redis

        r = Redis.from_url(url)
        r.ping()
        return {"status": "ok"}
    except ImportError:
        return {"status": "not_configured", "message": "redis package not installed"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:200]}


def _check_service_health(name: str, url: str, timeout: float = 2.0) -> dict[str, Any]:
    """Ping a service /health endpoint."""
    if not url or not url.strip():
        return {"status": "not_configured", "url": None}
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.get(f"{url.rstrip('/')}/health")
            if r.status_code == 200:
                return {"status": "ok", "url": url}
            return {"status": "error", "url": url, "code": r.status_code}
    except Exception as e:
        return {"status": "offline", "url": url, "error": str(e)[:200]}


@app.get("/api/v1/health/detailed")
def health_detailed() -> dict[str, Any]:
    """Detailed health for Studio. Includes Supabase, Redis, compile, simulation, deploy, tools, RAG.
    Includes p95_latency_ms for SLO monitoring (target: under 2000ms)."""
    versions = get_registry_versions()
    services: dict[str, Any] = {"orchestrator": {"status": "ok"}}
    p95 = _p95_latency_ms()
    if p95 is not None:
        services["orchestrator"]["p95_latency_ms"] = round(p95, 0)
        services["orchestrator"]["slo_ok"] = p95 < 2000
    services["supabase"] = _check_supabase_health()
    services["redis"] = _check_redis_health()
    services["compile"] = _check_service_health("compile", COMPILE_SERVICE_URL)
    services["audit"] = _check_service_health("audit", AUDIT_SERVICE_URL)
    sim_url = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002").strip()
    services["simulation"] = _check_service_health("simulation", sim_url)
    deploy_url = os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003").strip()
    services["deploy"] = _check_service_health("deploy", deploy_url)
    # RAG/vectordb: NOT_APPLICABLE when not configured for MVP; else check health
    try:
        from rag_client import is_configured as rag_configured
        if not rag_configured():
            services["rag"] = {"status": "NOT_APPLICABLE", "message": "RAG/vectordb not configured for MVP"}
        else:
            services["rag"] = _check_service_health("rag", VECTORDB_URL)
    except ImportError:
        services["rag"] = {"status": "NOT_APPLICABLE", "message": "RAG client not available"}
    # Exploit simulation: NOT_APPLICABLE when disabled
    exploit_enabled = os.environ.get("EXPLOIT_SIM_ENABLED", "false").lower() in ("true", "1", "yes")
    services["exploit_sim"] = {"status": "NOT_APPLICABLE", "message": "Exploit simulation disabled"} if not exploit_enabled else {"status": "ok", "message": "Enabled"}
    # Trace writer: stub when IPFS not configured (no health endpoint)
    pinata_ok = bool(os.environ.get("PINATA_API_KEY") or os.environ.get("PINATA_JWT"))
    services["trace_writer"] = {"status": "NOT_APPLICABLE", "message": "IPFS not configured; traces use stub IDs"} if not pinata_ok else {"status": "ok", "message": "IPFS configured"}
    if TOOLS_BASE_URL:
        tools_status = _check_tools_health()
        services["tools"] = tools_status
        if tools_status.get("status") == "offline":
            services["tools"][
                "message"
            ] = "Toolchain offline; compile/audit may fail when using remote tools"
    return {"status": "ok", "services": services, "registries": versions}
