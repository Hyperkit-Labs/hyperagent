"""
HyperAgent Orchestrator
FastAPI app: workflows CRUD, runs, networks, metrics, BYOK, deploy, UI schema. Studio contract for E2E.
"""
import asyncio
import json
import logging
import os
import uuid
from typing import Any

logger = logging.getLogger(__name__)


def _log_byok_event(event: str, user_id: str, action: str) -> None:
    """Structured security log for BYOK access (no key values)."""
    logger.warning("[security] %s", json.dumps({"event": event, "byok_action": action, "user_id": user_id}))

import httpx
from fastapi import BackgroundTasks, Body, FastAPI, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from llm_keys_store import (
    get_configured_providers,
    get_keys_for_pipeline,
    set_keys,
    delete_keys,
    DEFAULT_WORKSPACE,
)
import llm_keys_supabase
import payments_supabase
import credits_supabase
from registries import DEFAULT_PIPELINE_ID, ANCHOR_NETWORK_SLUG, get_registry_versions, get_networks_for_api, get_templates_for_api, get_template, get_x402_enabled, get_timeout, get_monitoring_enabled, get_chain_rpc_explorer, get_chain_id_by_network_slug, get_default_chain_id, get_x402_plans, get_x402_plan, get_x402_resources, get_resource_price, get_stablecoins_by_chain, check_plan_limit, get_a2a_agent_id, get_a2a_default_chain_id, get_erc8004_agent_identity
from store import (
    create_workflow,
    update_workflow,
    get_workflow,
    list_workflows,
    count_workflows,
    append_deployment,
    MAX_INTENT_LENGTH,
)
from workflow import run_pipeline
from trace_context import set_request_id, get_trace_headers
import db

COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")

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


def _create_agent_session_jwt_if_configured(user_id: str, run_id: str, api_keys: dict) -> str | None:
    """When JWT_SECRET_KEY and AGENT_SESSION_PAYLOAD_KEY are set, return short-lived JWT with encrypted api_keys."""
    if not api_keys:
        return None
    if not os.environ.get("JWT_SECRET_KEY") or not os.environ.get("AGENT_SESSION_PAYLOAD_KEY"):
        return None
    try:
        from agent_session_jwt import create_agent_session_jwt
        return create_agent_session_jwt(sub=user_id, run_id=run_id, api_keys=api_keys)
    except Exception as e:
        logger.error("[agent-session] JWT creation failed user_id=%s run_id=%s: %s", user_id, run_id, e, exc_info=True)
        return None

app = FastAPI(title="HyperAgent Orchestrator", version="0.1.0")


@app.middleware("http")
async def log_request_id(request: Request, call_next):
    """Set and log x-request-id for trace correlation; downstream services receive it from gateway."""
    rid = (request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or "").strip() or None
    set_request_id(rid)
    if rid:
        logger.info("[orchestrator] request_id=%s path=%s", rid, request.url.path)
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _get_caller_id(request: Request) -> str | None:
    """Extract authenticated user id from gateway-injected header."""
    return (request.headers.get("X-User-Id") or request.headers.get("x-user-id") or "").strip() or None


def _assert_workflow_owner(w: dict[str, Any], request: Request) -> None:
    """Raise 403 if authenticated user does not own the workflow.
    When workflow has an owner (not anonymous), require authenticated caller."""
    caller = _get_caller_id(request)
    owner = w.get("user_id") or ""
    if owner and owner != "anonymous":
        if not caller:
            raise HTTPException(status_code=403, detail="Access denied")
        if caller != owner:
            raise HTTPException(status_code=403, detail="Access denied")


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
    safe = (value or fallback).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
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
    nlp_input: str = Field(..., alias="nlp_input", min_length=1, max_length=MAX_INTENT_LENGTH)
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
    if request_id:
        logger.info("[orchestrator] pipeline start workflow_id=%s request_id=%s", workflow_id, request_id)
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
        status = "completed" if current_stage in ("deployed", "deploy", "ui_scaffold") else (
            "failed" if current_stage in ("audit_failed", "simulation_failed", "failed") else "building"
        )
        autofix_cycle = final.get("autofix_cycle", 0)
        guardian_violations = final.get("invariant_violations") or []
        stages = [
            {"stage": "spec", "status": "completed"},
            {"stage": "design", "status": "completed" if final.get("design_proposal") else "pending"},
            {"stage": "codegen", "status": "completed" if final.get("contracts") else "pending"},
            {"stage": "audit", "status": "completed" if final.get("audit_passed") else ("failed" if final.get("audit_findings") else "pending")},
        ]
        if autofix_cycle > 0:
            stages.append({"stage": "autofix", "status": "completed", "cycles": autofix_cycle})
        if final.get("invariants"):
            stages.append({"stage": "guardian", "status": "failed" if guardian_violations else "completed"})
        stages += [
            {"stage": "simulation", "status": "completed" if final.get("simulation_passed") else ("failed" if final.get("simulation_results") and not final.get("simulation_passed") else "pending")},
            {"stage": "deploy", "status": "completed" if current_stage in ("deployed", "ui_scaffold") else "pending"},
            {"stage": "ui_scaffold", "status": "completed" if final.get("ui_schema") else "pending"},
        ]
        codegen_mode = "oz_wizard" if final.get("use_oz_wizard") else "custom"
        oz_opts = final.get("oz_wizard_options") or None
        update_workflow(
            workflow_id=workflow_id,
            status=status,
            stages=stages,
            contracts=final.get("contracts") or {},
            deployments=final.get("deployments") or [],
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
                    metadata={"workflow_id": workflow_id, "current_stage": current_stage},
                )
            except Exception as pay_err:
                logger.warning("[x402] insert_payment failed workflow_id=%s err=%s", workflow_id, pay_err)
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
    x_user_id = (request.headers.get("X-User-Id") or request.headers.get("x-user-id") or "").strip() or None
    workflow_id = str(uuid.uuid4())
    user_id = body.user_id or x_user_id or "anonymous"
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
            raise HTTPException(status_code=402, detail="Failed to deduct credits. Top up and try again.")
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
    agent_session_jwt = _create_agent_session_jwt_if_configured(user_id, workflow_id, api_keys)
    if db.is_configured():
        effective_user = user_id if db._is_uuid(user_id) else os.environ.get("SUPABASE_SYSTEM_USER_ID")
        if effective_user and db.ensure_project(project_id, effective_user):
            db.insert_run(workflow_id, project_id, status="running", workflow_version="0.1.0")
    create_workflow(
        workflow_id=workflow_id,
        intent=body.nlp_input,
        network=body.network or "",
        user_id=user_id,
        project_id=project_id,
        template_id=body.template_id,
    )
    request_id = (request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or "").strip() or None
    background_tasks.add_task(
        _run_workflow_pipeline_job,
        workflow_id,
        user_id,
        project_id,
        body.nlp_input,
        api_keys,
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
def list_workflows_api(limit: int = 50, status: str | None = None, request: Request = None) -> dict[str, Any]:
    """List workflows for Studio. Newest first. Scoped to authenticated user."""
    items = list_workflows(limit=min(limit, 100), status=status)
    caller = _get_caller_id(request) if request else None
    if caller:
        items = [i for i in items if (i.get("user_id") or "anonymous") in (caller, "anonymous")]
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
    return out


@app.get("/api/v1/workflows/{workflow_id}/status")
def get_workflow_status_api(workflow_id: str, request: Request = None) -> dict[str, str]:
    """Return workflow status only."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return {"status": w.get("status") or "unknown"}


@app.get("/api/v1/workflows/{workflow_id}/contracts")
def get_workflow_contracts_api(workflow_id: str, request: Request = None) -> list[dict[str, Any]]:
    """Return generated contracts for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    contracts = w.get("contracts") or {}
    return [
        {"contract_name": name.replace(".sol", ""), "source_code": code, "contract_type": "solidity"}
        for name, code in contracts.items()
        if isinstance(code, str)
    ]


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
def stream_workflow_code_api(workflow_id: str, request: Request = None) -> StreamingResponse:
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


def _stream_agent_discussion_sse(workflow_id: str):
    """Yield SSE events showing autofix cycles, guardian checks, and agent discussions."""
    w = get_workflow(workflow_id)
    if not w:
        return
    stages = w.get("stages") or []
    autofix_stages = [s for s in stages if s.get("stage") == "autofix"]
    guardian_stages = [s for s in stages if s.get("stage") == "guardian"]
    audit_stages = [s for s in stages if s.get("stage") == "audit"]

    for stage in stages:
        name = stage.get("stage", "unknown")
        status = stage.get("status", "pending")
        cycles = stage.get("cycles")
        event = {"stage": name, "status": status}
        if cycles:
            event["cycles"] = cycles
        yield f"data: {json.dumps(event)}\n\n".encode()

    if autofix_stages:
        cycle_count = autofix_stages[0].get("cycles", 0)
        yield f"data: {json.dumps({'type': 'agent_discussion', 'message': f'Autofix agent ran {cycle_count} correction cycle(s)'})}\n\n".encode()

    if guardian_stages:
        guardian_status = guardian_stages[0].get("status", "pending")
        yield f"data: {json.dumps({'type': 'agent_discussion', 'message': f'Guardian invariant check: {guardian_status}'})}\n\n".encode()

    findings = w.get("audit_findings") or []
    if findings:
        yield f"data: {json.dumps({'type': 'audit_summary', 'findings_count': len(findings), 'passed': w.get('audit_passed', False)})}\n\n".encode()

    yield f"data: {json.dumps({'done': True})}\n\n".encode()


@app.get("/api/v1/streaming/workflows/{workflow_id}/discussion")
def stream_agent_discussion_api(workflow_id: str, request: Request = None) -> StreamingResponse:
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
def get_workflow_deployments_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Return deployments for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    return {"deployments": w.get("deployments") or []}


@app.get("/api/v1/workflows/{workflow_id}/ui-schema")
def get_workflow_ui_schema_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
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
async def generate_workflow_ui_schema_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Generate UI schema from first deployment and contract; store and return."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    deployments = w.get("deployments") or []
    if not deployments:
        raise HTTPException(status_code=400, detail="No deployments; deploy a contract first")
    contracts = w.get("contracts") or {}
    from agents.ui_scaffold_agent import generate_ui_schema
    schema = await generate_ui_schema(deployments, contracts, w.get("network") or "")
    if not schema:
        raise HTTPException(status_code=400, detail="Could not build schema (missing ABI or compile failed)")
    update_workflow(workflow_id, ui_schema=schema)
    return {"workflow_id": workflow_id, "ui_schema": schema}


class UiAppExportBody(BaseModel):
    template: str = "hyperagent-default"


@app.post("/api/v1/workflows/{workflow_id}/ui-apps/export")
def export_ui_app_api(workflow_id: str, body: UiAppExportBody | None = None, request: Request = None) -> dict[str, Any]:
    """Export dApp as zip: full React/Next.js scaffold with contract integration. Returns zip_base64 and filename."""
    import base64
    import zipfile
    import io
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    schema = w.get("ui_schema")
    if not schema:
        raise HTTPException(status_code=400, detail="Generate UI schema first (POST /ui-schema/generate)")
    template = (body.template if body else "hyperagent-default") or "hyperagent-default"
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
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("ui_schema.json", json.dumps(schema, indent=2))
        zf.writestr("package.json", json.dumps({
            "name": app_name,
            "version": "0.1.0",
            "private": True,
            "scripts": {"dev": "next dev", "build": "next build", "start": "next start"},
            "dependencies": {
                "next": "14.2.0", "react": "^18.2.0", "react-dom": "^18.2.0",
                "ethers": "^6.13.0", "tailwindcss": "^3.4.0",
            },
            "devDependencies": {"typescript": "^5.0.0", "@types/react": "^18.2.0", "@types/node": "^20.0.0"},
        }, indent=2))
        zf.writestr("tsconfig.json", json.dumps({
            "compilerOptions": {"target": "es2017", "lib": ["dom", "es2017"], "jsx": "preserve",
                "module": "esnext", "moduleResolution": "bundler", "strict": True,
                "esModuleInterop": True, "skipLibCheck": True, "forceConsistentCasingInFileNames": True,
                "resolveJsonModule": True, "isolatedModules": True, "noEmit": True, "incremental": True,
                "paths": {"@/*": ["./src/*"]}},
            "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"], "exclude": ["node_modules"],
        }, indent=2))
        zf.writestr("tailwind.config.ts", 'import type { Config } from "tailwindcss";\nconst config: Config = { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\nexport default config;\n')
        zf.writestr("next.config.mjs", '/** @type {import("next").NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n')
        zf.writestr("src/lib/contract.ts", f'''import {{ ethers }} from "ethers";\n\nexport const CONTRACT_ADDRESS = "{contract_addr}";\nexport const CHAIN_ID = {chain_id};\nexport const ABI = {json.dumps(abi)} as const;\n\nexport function getContract(signerOrProvider: ethers.Signer | ethers.Provider) {{\n  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);\n}}\n''')
        read_imports = "\n".join(f"  async {a['fn']}({', '.join(p['name'] + ': string' for p in a.get('params', []))}): Promise<string> {{\n    const result = await this.contract.{a['fn']}({', '.join(p['name'] for p in a.get('params', []))});\n    return String(result);\n  }}" for a in read_actions)
        write_imports = "\n".join(f"  async {a['fn']}({', '.join(p['name'] + ': string' for p in a.get('params', []))}): Promise<ethers.TransactionResponse> {{\n    return this.contract.{a['fn']}({', '.join(p['name'] for p in a.get('params', []))});\n  }}" for a in write_actions)
        zf.writestr("src/lib/actions.ts", f'import {{ ethers }} from "ethers";\nimport {{ getContract }} from "./contract";\n\nexport class ContractActions {{\n  private contract: ethers.Contract;\n  constructor(signerOrProvider: ethers.Signer | ethers.Provider) {{\n    this.contract = getContract(signerOrProvider);\n  }}\n{read_imports}\n{write_imports}\n}}\n')
        action_buttons = "".join(f'\n          <button onClick={{() => handleAction("{a["fn"]}")}} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">{a.get("label", a["fn"])}</button>' for a in write_actions[:5])
        read_displays = "".join(f'\n          <div className="p-3 bg-gray-800 rounded-lg"><span className="text-gray-400 text-xs">{a.get("label", a["fn"])}</span><div id="{a["fn"]}" className="text-white font-mono mt-1">-</div></div>' for a in read_actions[:5])
        zf.writestr("src/app/page.tsx", f'''"use client";\n\nimport {{ useState }} from "react";\nimport {{ CONTRACT_ADDRESS, CHAIN_ID }} from "@/lib/contract";\n\nexport default function Home() {{\n  const [status, setStatus] = useState("");\n\n  async function handleAction(fn: string) {{\n    setStatus(`Calling ${{fn}}...`);\n    try {{\n      const {{ ethers }} = await import("ethers");\n      if (!window.ethereum) {{ setStatus("Connect MetaMask"); return; }}\n      const provider = new ethers.BrowserProvider(window.ethereum);\n      const signer = await provider.getSigner();\n      const {{ ContractActions }} = await import("@/lib/actions");\n      const actions = new ContractActions(signer);\n      const tx = await (actions as Record<string, (...args: string[]) => Promise<unknown>>)[fn]();\n      setStatus(`TX sent: ${{String(tx)}}`); \n    }} catch (e) {{\n      setStatus(`Error: ${{e instanceof Error ? e.message : String(e)}}`);\n    }}\n  }}\n\n  return (\n    <main className="min-h-screen bg-gray-900 text-white p-8">\n      <div className="max-w-2xl mx-auto space-y-6">\n        <h1 className="text-3xl font-bold">{schema.get("name", "dApp")}</h1>\n        <p className="text-gray-400">Contract: <code className="text-xs">{{CONTRACT_ADDRESS}}</code> on chain {{CHAIN_ID}}</p>\n        <div className="grid grid-cols-2 gap-3">{read_displays}\n        </div>\n        <div className="flex flex-wrap gap-2">{action_buttons}\n        </div>\n        {{status && <p className="text-sm text-yellow-400 mt-4">{{status}}</p>}}\n      </div>\n    </main>\n  );\n}}\n\ndeclare global {{\n  interface Window {{ ethereum?: {{ request: (args: {{ method: string; params?: unknown[] }}) => Promise<unknown> }} }}\n}}\n''')
        zf.writestr("src/app/layout.tsx", f'import type {{ Metadata }} from "next";\nimport "./globals.css";\n\nexport const metadata: Metadata = {{ title: "{schema.get("name", "dApp")}", description: "Generated by HyperAgent" }};\n\nexport default function RootLayout({{ children }}: {{ children: React.ReactNode }}) {{\n  return <html lang="en"><body>{{children}}</body></html>;\n}}\n')
        zf.writestr("src/app/globals.css", '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n')
        zf.writestr("README.md", f"# {schema.get('name', 'dApp')}\n\nGenerated by HyperAgent.\n\n## Setup\n\n```bash\nnpm install\nnpm run dev\n```\n\nOpen http://localhost:3000\n\n## Contract\n\n- Address: `{contract_addr}`\n- Chain ID: {chain_id}\n- Actions: {len(read_actions)} read, {len(write_actions)} write\n")
    buf.seek(0)
    zip_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    filename = f"{app_name}-{workflow_id[:8]}.zip"
    return {
        "workflow_id": workflow_id,
        "ui_schema": schema,
        "template": template,
        "zip_base64": zip_b64,
        "filename": filename,
        "files": ["package.json", "tsconfig.json", "tailwind.config.ts", "next.config.mjs",
                  "src/lib/contract.ts", "src/lib/actions.ts", "src/app/page.tsx",
                  "src/app/layout.tsx", "src/app/globals.css", "ui_schema.json", "README.md"],
        "message": "React/Next.js scaffold exported; download zip and run npm install && npm run dev",
    }


class PrepareDeployBody(BaseModel):
    mainnet_confirm: bool = Field(False, description="Set true to confirm mainnet deploy; required for mainnet chain_id.")


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
        return {"workflow_id": workflow_id, "error": "No contracts to deploy", "chainId": chain_id}
    first_name = next((n for n in contracts if isinstance(contracts.get(n), str)), None)
    if not first_name:
        return {"workflow_id": workflow_id, "error": "No contract source", "chainId": chain_id}
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
        return {"workflow_id": workflow_id, "error": data.get("errors", ["Compilation failed"])[0] if data.get("errors") else "Compilation failed", "chainId": chain_id}
    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer:
        raise HTTPException(status_code=400, detail=f"Chain {chain_id} not in registry; add to infra/registries/network/chains.yaml")
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


@app.post("/api/v1/workflows/{workflow_id}/deploy/complete")
def complete_deploy_api(workflow_id: str, body: DeployCompleteBody, request: Request = None) -> dict[str, Any]:
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
def clarify_workflow_api(workflow_id: str, body: ClarifyBody, request: Request = None) -> dict[str, Any]:
    """Persist user clarification message on workflow and return updated clarification list."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    from datetime import UTC, datetime
    meta = w.get("metadata") or {}
    clarifications = list(meta.get("clarifications") or [])
    entry = {"message": (body.message or "").strip() or "(empty)", "at": datetime.now(UTC).isoformat()}
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


@app.get("/api/v1/runs/{run_id}/steps")
def get_run_steps_api(run_id: str, request: Request = None) -> dict[str, Any]:
    """Return step-level audit for a run (Phase 1). Empty when Supabase not configured."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    if request:
        _assert_workflow_owner(w, request)
    steps = db.get_steps(run_id)
    return {"run_id": run_id, "steps": steps}


# ---------------------------------------------------------------------------
# Networks, metrics, presets
# ---------------------------------------------------------------------------

@app.get("/api/v1/networks")
def get_networks_api(skale: bool = False) -> list[dict[str, Any]]:
    """Return networks from chain registry. When skale=true, return SKALE Base networks."""
    return get_networks_for_api(skale=skale)


@app.get("/api/v1/tokens/stablecoins")
def get_stablecoins_api() -> dict[str, dict[str, str]]:
    """Return USDC/USDT addresses per chain from x402/stablecoins.yaml. Keys are chain IDs as strings."""
    return get_stablecoins_by_chain()


AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001").rstrip("/")
VECTORDB_URL = os.environ.get("VECTORDB_URL", "http://localhost:8010").rstrip("/")
INTEGRATIONS_TIMEOUT = 2.0


async def _fetch_integrations() -> dict[str, bool]:
    """Fetch integration status from agent-runtime and vectordb health endpoints."""
    tenderly = False
    pinata = False
    qdrant = False
    async with httpx.AsyncClient(timeout=INTEGRATIONS_TIMEOUT) as client:
        try:
            r = await client.get(f"{AGENT_RUNTIME_URL}/health")
            if r.status_code == 200:
                data = r.json()
                tenderly = data.get("tenderly_configured", False)
                pinata = data.get("pinata_configured", False)
        except Exception:
            pass
        try:
            r = await client.get(f"{VECTORDB_URL}/health")
            if r.status_code == 200:
                data = r.json()
                qdrant = data.get("qdrant_configured", False)
        except Exception:
            pass
    return {"tenderly_configured": tenderly, "pinata_configured": pinata, "qdrant_configured": qdrant}


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
                r = client.table("wallet_users").select("plan_id").eq("id", x_user_id).maybe_single().execute()
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


@app.get("/api/v1/metrics")
def get_metrics_api() -> dict[str, Any]:
    """Return basic metrics for Studio dashboard. Counts from runs table when Supabase is configured."""
    total = count_workflows()
    active = 0
    completed = 0
    failed = 0
    if db.is_configured():
        try:
            client = db._client()
            if client:
                for status_val, counter_name in [("running", "active"), ("success", "completed"), ("failed", "failed")]:
                    r = client.table("runs").select("id", count="exact").eq("status", status_val).execute()
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
    return {
        "workflows": {"total": total, "active": active, "completed": completed, "failed": failed},
        "total_workflows": total,
    }


@app.get("/api/v1/presets")
def get_presets_api() -> list[dict[str, Any]]:
    """Return presets from token template registry."""
    return [
        {"id": t["id"], "name": t.get("name", t["id"]), "description": t.get("description", "")}
        for t in get_templates_for_api()
    ]


@app.get("/api/v1/blueprints")
def get_blueprints_api() -> list[dict[str, Any]]:
    """Return blueprints from token template registry; same source as presets."""
    return [
        {"id": t["id"], "name": t.get("name", t["id"]), "description": t.get("description", "")}
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
        raise HTTPException(status_code=401, detail="X-User-Id required when BYOK persistence is configured")


def _trace_llm_keys(
    request: Request,
    method: str,
    x_user_id: str | None,
    x_workspace_id: str | None,
    outcome: str,
    provider_count: int | None = None,
) -> None:
    """Structured trace for llm-keys requests; correlate with gateway auth logs via x-request-id."""
    request_id = request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
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
        _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        _log_byok_event("byok_access", x_user_id, "get_configured_providers")
        providers = llm_keys_supabase.get_configured_providers(x_user_id)
        _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "success", provider_count=len(providers))
        return {"configured_providers": providers}
    if llm_keys_supabase._is_configured():
        return {"configured_providers": []}
    providers = get_configured_providers(wid)
    _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "success", provider_count=len(providers))
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
        _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    # Production: require encryption (Fernet or KMS) for BYOK persistence.
    if os.environ.get("ENV") == "production" and not (os.environ.get("LLM_KEY_ENCRYPTION_KEY") or os.environ.get("LLM_KEY_KMS_KEY_ARN")):
        if x_user_id and (body.keys or {}):
            _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "503_missing_encryption_key")
            raise HTTPException(
                status_code=503,
                detail="BYOK requires LLM_KEY_ENCRYPTION_KEY or LLM_KEY_KMS_KEY_ARN in production",
            )
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        _log_byok_event("byok_access", x_user_id, "set_keys")
        providers = llm_keys_supabase.set_keys_for_user(x_user_id, body.keys or {})
        if body.keys and not providers:
            _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "error_storage", provider_count=0)
            raise HTTPException(
                status_code=503,
                detail="BYOK storage failed. Check LLM_KEY_ENCRYPTION_KEY, SUPABASE_URL, and SUPABASE_SERVICE_KEY.",
            )
        _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "success", provider_count=len(providers))
        return {"configured_providers": providers}
    if llm_keys_supabase._is_configured():
        raise HTTPException(
            status_code=503,
            detail="BYOK persistence is configured; sign in and use the gateway so X-User-Id is set.",
        )
    providers = set_keys(wid, body.keys or {})
    _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "success", provider_count=len(providers))
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
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        _log_byok_event("byok_access", x_user_id, "delete_keys")
        ok = llm_keys_supabase.delete_keys_for_user(x_user_id)
        if not ok:
            _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "error_no_row_updated")
            raise HTTPException(
                status_code=500,
                detail="Failed to clear LLM keys. No matching user found. Sign out and sign in again, then try Remove all keys.",
            )
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
        return {"success": True}
    if llm_keys_supabase._is_configured():
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "skipped_no_user_id")
        return {"success": True}
    delete_keys(wid)
    _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
    return {"success": True}


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
    return [t for t in all_t if ql in (t.get("name") or "").lower() or ql in (t.get("id") or "").lower()]


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
    items, total = payments_supabase.get_payment_history(x_user_id, limit=min(100, max(1, limit)), offset=max(0, offset))
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
    return {"budget": "0", "currency": "USD", "period": "monthly", "alert_threshold_percent": 80, "spent": "0"}


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
            "alert_threshold_percent": int(row.get("alert_threshold_percent", 80) or 80),
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
    row = payments_supabase.upsert_spending_control(
        x_user_id,
        budget_amount=body.budget_amount,
        budget_currency=body.budget_currency or "USD",
        period=period,
        alert_threshold_percent=body.alert_threshold_percent,
    )
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
    amount: float = Field(gt=0, description="Credit amount to add (e.g. fiat/USDC/USDT conversion)")
    currency: str = "USD"
    reference_id: str | None = None
    reference_type: str | None = "manual"


@app.post("/api/v1/credits/top-up")
def credits_top_up_api(
    body: CreditsTopUpBody,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Record a credit top-up (e.g. after Stripe/fiat or USDC/USDT). Idempotency via reference_id recommended.
    When amount is in USD (usdc_transfer, fiat), it is multiplied by CREDITS_PER_USD to get credits."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id required")
    if not credits_supabase.is_configured():
        raise HTTPException(status_code=503, detail="Credits not configured")
    is_usd_input = (body.reference_type or "").lower() in ("usdc_transfer", "usdt_transfer", "fiat") or (body.currency or "").upper() == "USD"
    credits_to_add = body.amount * CREDITS_PER_USD if is_usd_input else body.amount
    result = credits_supabase.top_up(
        x_user_id,
        amount=credits_to_add,
        currency=body.currency or "USD",
        reference_id=body.reference_id,
        reference_type=body.reference_type or "manual",
        metadata={"usd_amount": body.amount, "credits_per_usd": CREDITS_PER_USD} if is_usd_input else None,
    )
    if not result:
        raise HTTPException(status_code=500, detail="Top-up failed")
    return {"balance": result["balance"], "currency": result["currency"], "user_id": result["user_id"]}


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
        services = sorted({str(e.get("service", "orchestrator")) for e in logs if e.get("service")})
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
        return ["orchestrator"] if (os.environ.get("ORCHESTRATOR_HOST") or "").strip() else []


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
        return {"success": False, "error": "contract_address and function_name required"}
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
        rpc_url, body.contract_address, body.abi, body.function_name, body.function_args or []
    )
    if not ok:
        return {"success": False, "error": err or "RPC call failed"}
    return {"success": True, "result": result}


@app.post("/api/v1/contracts/call")
def contract_call_api(body: ContractCallBody) -> dict[str, Any]:
    """Build unsigned transaction for contract write; client signs and submits."""
    if not body.contract_address or not body.function_name:
        return {"success": False, "error": "contract_address and function_name required"}
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
    return {"success": True, "transaction": tx, "message": "Sign and send with your wallet"}


# ---------------------------------------------------------------------------
# Legacy /run and health
# ---------------------------------------------------------------------------

@app.post("/run")
def create_run_legacy(req: RunRequest) -> dict[str, Any]:
    """Legacy POST /run; returns run_id. Prefer POST /api/v1/workflows/generate."""
    workflow_id = str(uuid.uuid4())
    project_id = req.project_id or workflow_id
    api_keys = req.api_keys or _get_keys_for_run(req.user_id or "", DEFAULT_WORKSPACE)
    if not api_keys:
        raise HTTPException(
            status_code=422,
            detail="LLM API keys are required to run the pipeline. Add keys in Settings (workspace LLM keys).",
        )
    agent_session_jwt = _create_agent_session_jwt_if_configured(req.user_id, workflow_id, api_keys)
    create_workflow(workflow_id=workflow_id, intent=req.user_prompt, user_id=req.user_id, project_id=project_id)
    if db.is_configured():
        effective_user = req.user_id if db._is_uuid(req.user_id) else os.environ.get("SUPABASE_SYSTEM_USER_ID")
        if effective_user and db.ensure_project(project_id, effective_user):
            db.insert_run(workflow_id, project_id, status="running", workflow_version="0.1.0")
    try:
        final = run_pipeline(
            req.user_prompt,
            req.user_id,
            req.project_id,
            workflow_id,
            api_keys,
            req.pipeline_id,
            agent_session_jwt=agent_session_jwt,
        )
        stage = final.get("current_stage", "unknown")
        status = "success" if stage in ("deployed", "design_review", "audit", "simulation", "deploy") else (
            "running" if stage == "spec_review" else "failed"
        )
        store_status = "completed" if status == "success" else "failed"
        update_workflow(workflow_id, status=store_status)
        if db.is_configured():
            db.update_run(workflow_id, status="success" if status == "success" else "failed", current_stage=stage)
        return {"run_id": workflow_id, "status": status, "current_stage": stage, "message": "Pipeline completed"}
    except Exception as e:
        update_workflow(workflow_id, status="failed", error=str(e))
        if db.is_configured():
            db.update_run(workflow_id, status="failed", error_message=str(e))
        raise HTTPException(status_code=500, detail=str(e))


def _approve_spec_impl(run_id: str, request: Request | None = None) -> dict[str, Any]:
    """Set spec_approved and resume pipeline from design node."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        _assert_workflow_owner(w, request)
    if not w.get("spec"):
        raise HTTPException(status_code=400, detail="No spec to approve; run must be at spec_review")
    update_workflow(run_id, spec_approved=True)
    user_id = w.get("user_id") or "anonymous"
    project_id = w.get("project_id") or run_id
    api_keys = _get_keys_for_run(user_id, DEFAULT_WORKSPACE)
    agent_session_jwt = _create_agent_session_jwt_if_configured(user_id, run_id, api_keys)
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
            db.update_run(run_id, status=_run_status_for_store(status), current_stage=stage)
        return {"run_id": run_id, "status": status, "current_stage": stage, "message": "Resumed from design"}
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


# Vercel Sandbox: https://vercel.com/docs/vercel-sandbox, https://vercel.com/docs/vercel-sandbox/concepts/authentication
VERCEL_SANDBOX_API = "https://api.vercel.com/v1/sandboxes"
VERCEL_SANDBOX_TOKEN = (
    os.environ.get("VERCEL_SANDBOX_TOKEN", "").strip()
    or os.environ.get("VERCEL_TOKEN", "").strip()
)
VERCEL_TEAM_ID = os.environ.get("VERCEL_TEAM_ID", "").strip()
VERCEL_PROJECT_ID = os.environ.get("VERCEL_PROJECT_ID", "").strip()
DEMO_SANDBOX_SOURCE_URL = os.environ.get("DEMO_SANDBOX_SOURCE_URL", "https://github.com/NomicFoundation/hardhat-template").strip()
DEMO_SANDBOX_SOURCE_TYPE = os.environ.get("DEMO_SANDBOX_SOURCE_TYPE", "git").strip().lower()


def _ensure_vercel_sandbox_env() -> None:
    """Ensure Vercel Sandbox SDK reads our env vars. SDK uses VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID."""
    if VERCEL_SANDBOX_TOKEN and not os.environ.get("VERCEL_TOKEN"):
        os.environ["VERCEL_TOKEN"] = VERCEL_SANDBOX_TOKEN
    if VERCEL_TEAM_ID and not os.environ.get("VERCEL_TEAM_ID"):
        os.environ["VERCEL_TEAM_ID"] = VERCEL_TEAM_ID
    if VERCEL_PROJECT_ID and not os.environ.get("VERCEL_PROJECT_ID"):
        os.environ["VERCEL_PROJECT_ID"] = VERCEL_PROJECT_ID


@app.post("/api/v1/quick-demo")
async def quick_demo_api() -> dict[str, Any]:
    """Create a Vercel Sandbox from the demo template using the official SDK.
    Returns sandbox URL for Try it Now. Requires VERCEL_SANDBOX_TOKEN or VERCEL_TOKEN.
    For non-Vercel hosting, also set VERCEL_TEAM_ID and VERCEL_PROJECT_ID.
    Local dev: run `vercel link` and `vercel env pull` to get .env.local with VERCEL_OIDC_TOKEN."""
    if not VERCEL_SANDBOX_TOKEN and not os.environ.get("VERCEL_TOKEN") and not os.environ.get("VERCEL_OIDC_TOKEN"):
        raise HTTPException(status_code=503, detail="Quick demo not configured: set VERCEL_SANDBOX_TOKEN, VERCEL_TOKEN, or run vercel env pull")
    _ensure_vercel_sandbox_env()
    source_type = "tarball" if DEMO_SANDBOX_SOURCE_TYPE == "tarball" else "git"
    source: dict[str, Any] = {"type": source_type, "url": DEMO_SANDBOX_SOURCE_URL}
    create_kwargs: dict[str, Any] = {
        "source": source,
        "runtime": "node24",
        "ports": [3000],
        "timeout": 300000,
    }
    if VERCEL_PROJECT_ID:
        create_kwargs["project_id"] = VERCEL_PROJECT_ID
    if VERCEL_TEAM_ID:
        create_kwargs["team_id"] = VERCEL_TEAM_ID
    try:
        from vercel.sandbox import AsyncSandbox

        sandbox = await AsyncSandbox.create(**create_kwargs)
        sandbox_id = getattr(sandbox, "sandbox_id", None) or getattr(sandbox, "sandboxId", None) or getattr(sandbox, "id", None)
        status = getattr(sandbox, "status", "running")
        url: str | None = None
        try:
            url = sandbox.domain(3000)
        except Exception:
            pass
        return {
            "sandbox_id": sandbox_id,
            "url": url,
            "status": status,
        }
    except (ImportError, AttributeError) as e:
        logger.info("[quick-demo] SDK unavailable (%s), using REST API fallback", e)
        return await _quick_demo_via_rest()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[quick-demo] %s", e)
        raise HTTPException(status_code=502, detail=str(e)[:200])


async def _quick_demo_via_rest() -> dict[str, Any]:
    """Fallback: create sandbox via REST API when SDK is unavailable (e.g. Windows)."""
    token = VERCEL_SANDBOX_TOKEN or os.environ.get("VERCEL_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Quick demo not configured: VERCEL_SANDBOX_TOKEN or VERCEL_TOKEN required")
    source_type = "tarball" if DEMO_SANDBOX_SOURCE_TYPE == "tarball" else "git"
    source = {"type": source_type, "url": DEMO_SANDBOX_SOURCE_URL}
    body: dict[str, Any] = {
        "runtime": "node24",
        "source": source,
        "ports": [3000],
        "timeout": 300000,
    }
    if VERCEL_PROJECT_ID:
        body["projectId"] = VERCEL_PROJECT_ID
    params = {"teamId": VERCEL_TEAM_ID} if VERCEL_TEAM_ID else None
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            VERCEL_SANDBOX_API,
            json=body,
            params=params,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if r.status_code != 200:
            err = r.text[:500] if r.text else str(r.status_code)
            logger.warning("[quick-demo] Vercel API %s: %s", r.status_code, err)
            raise HTTPException(status_code=502, detail=f"Sandbox creation failed: {err}")
        data = r.json()
        routes = data.get("routes") or []
        sandbox = data.get("sandbox") or {}
        url = routes[0].get("url") if routes else None
        return {
            "sandbox_id": sandbox.get("id"),
            "url": url,
            "status": sandbox.get("status", "pending"),
        }


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
    """Detailed health for Studio. Includes Supabase, Redis, compile, simulation, deploy, tools, RAG."""
    versions = get_registry_versions()
    services: dict[str, Any] = {"orchestrator": {"status": "ok"}}
    services["supabase"] = _check_supabase_health()
    services["redis"] = _check_redis_health()
    services["compile"] = _check_service_health("compile", COMPILE_SERVICE_URL)
    sim_url = os.environ.get("SIMULATION_SERVICE_URL", "http://localhost:8002").strip()
    services["simulation"] = _check_service_health("simulation", sim_url)
    deploy_url = os.environ.get("DEPLOY_SERVICE_URL", "http://localhost:8003").strip()
    services["deploy"] = _check_service_health("deploy", deploy_url)
    services["rag"] = _check_service_health("rag", VECTORDB_URL)
    if TOOLS_BASE_URL:
        tools_status = _check_tools_health()
        services["tools"] = tools_status
        if tools_status.get("status") == "offline":
            services["tools"]["message"] = "Toolchain offline; compile/audit may fail when using remote tools"
    return {"status": "ok", "services": services, "registries": versions}
