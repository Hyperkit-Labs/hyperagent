"""
Workflow CRUD, streaming, and deploy API routes.
"""

import asyncio
import io
import json
import logging
import os
import tarfile
import time
from datetime import UTC, datetime
from typing import Any

import db
import httpx
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from llm_keys_store import DEFAULT_WORKSPACE
from pydantic import BaseModel, Field
from rate_limit import DEPLOY_LIMIT, limiter
from registries import (
    DEFAULT_PIPELINE_ID,
    get_chain_rpc_explorer,
    get_default_chain_id,
    get_timeout,
)
from store import append_deployment, get_workflow, list_workflows, update_workflow
from trace_context import get_trace_headers, set_request_id
from workflow import run_pipeline

from .common import (
    _create_agent_session_jwt_if_configured,
    _get_keys_for_run,
    _run_status_for_store,
    assert_workflow_owner,
    get_caller_id,
)

logger = logging.getLogger(__name__)

COMPILE_SERVICE_URL = os.environ.get(
    "COMPILE_SERVICE_URL", "http://localhost:8004"
).rstrip("/")


def _workflow_list_item(w: dict[str, Any]) -> dict[str, Any]:
    """Slim shape for list; exclude heavy contracts only so deployments show in Studio."""
    return {k: v for k, v in w.items() if k not in ("contracts",)}


def _build_workflow_tarball(workflow_id: str) -> bytes:
    """Build a minimal Hardhat project tarball from workflow contracts."""
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


CHUNK_SIZE = 512


def _stream_workflow_code_sse(workflow_id: str):
    """Yield SSE events: data: {"text": chunk} then data: {"done": true}."""
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


async def _stream_agent_discussion_sse(workflow_id: str):
    """Stream live pipeline events from run_steps and agent_logs."""
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
            return (
                ts,
                {
                    "_id": str(log.get("id", "")),
                    "_type": "log",
                    "event": {
                        "type": "log",
                        "stage": log.get("agent_name") or log.get("stage", "agent"),
                        "status": "info",
                        "message": (log.get("message") or log.get("stage") or "")[:1024]
                        or None,
                        "done": False,
                    },
                },
            )

        def _step_event(step: dict) -> tuple[str, dict]:
            ts = (
                step.get("started_at")
                or step.get("completed_at")
                or step.get("created_at")
                or ""
            )
            ev: dict = {
                "type": "step",
                "stage": step.get("step_type", "agent"),
                "status": step.get("status", "pending"),
                "message": (
                    step.get("output_summary")
                    or step.get("error_message")
                    or step.get("input_summary")
                    or step.get("status")
                    or ""
                )[:1024]
                or None,
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


def _build_hybrid_deploy_state(
    workflow_id: str, user_id: str, project_id: str, api_keys: dict
) -> dict[str, Any] | None:
    """Build hybrid state from workflow store for deploy resume when checkpoint is missing."""
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
        "audit_passed": w.get("audit_passed", False),
        "simulation_results": w.get("simulation_results") or {},
        "simulation_passed": w.get("simulation_passed", False),
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
    """Resume pipeline from deploy interrupt with deploy_approved=True."""
    set_request_id(None)
    final = None
    try:
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
                        "[orchestrator] deploy resume: checkpoint failed (%s), using hybrid state",
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
        err_msg = str(e)[:500]
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


# Request bodies
class PrepareDeployBody(BaseModel):
    mainnet_confirm: bool = Field(
        False,
        description="Set true to confirm mainnet deploy; required for mainnet chain_id.",
    )


class DeployCompleteBody(BaseModel):
    contractAddress: str = ""
    transactionHash: str = ""
    walletAddress: str = ""
    abi: list = Field(default_factory=list)
    chainId: int | None = None


class DeployApproveBody(BaseModel):
    api_keys: dict[str, str] | None = Field(
        None,
        description="Optional LLM keys for resume; when omitted, uses workspace keys.",
    )


class ClarifyBody(BaseModel):
    message: str = Field("", max_length=5000)


# Main workflow router
router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


@router.get("")
def list_workflows_api(
    limit: int = 50, status: str | None = None, request: Request = None
) -> dict[str, Any]:
    """List workflows for Studio. Newest first. Scoped to authenticated user."""
    items = list_workflows(limit=min(limit, 100), status=status)
    caller = get_caller_id(request) if request else None
    if caller:
        items = [i for i in items if (i.get("user_id") or "") == caller]
    else:
        items = []
    return {"workflows": [_workflow_list_item(i) for i in items]}


@router.get("/{workflow_id}")
def get_workflow_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Return single workflow by id. Validates caller owns the workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    out = {k: v for k, v in w.items() if k not in ("contracts", "deployments")}
    out["contracts"] = w.get("contracts") or {}
    out["deployments"] = w.get("deployments") or []
    meta = w.get("metadata") or {}
    if meta.get("error") and "error" not in out:
        out["error"] = meta["error"]
    return out


@router.get("/{workflow_id}/status")
def get_workflow_status_api(
    workflow_id: str, request: Request = None
) -> dict[str, str]:
    """Return workflow status only."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    return {"status": w.get("status") or "unknown"}


@router.get("/{workflow_id}/contracts")
def get_workflow_contracts_api(
    workflow_id: str, request: Request = None
) -> list[dict[str, Any]]:
    """Return generated contracts for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
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


@router.get("/{workflow_id}/tarball")
def get_workflow_tarball_api(workflow_id: str, request: Request = None) -> Response:
    """Return workflow as tarball for Docker sandbox dynamic source."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    data = _build_workflow_tarball(workflow_id)
    if not data:
        raise HTTPException(status_code=400, detail="No contracts to package")
    return Response(content=data, media_type="application/gzip")


@router.get("/{workflow_id}/deployments")
def get_workflow_deployments_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Return deployments for a workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    return {"deployments": w.get("deployments") or []}


@router.get("/{workflow_id}/ui-schema")
def get_workflow_ui_schema_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Return UI schema for contract interaction if generated."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    schema = w.get("ui_schema")
    if not schema:
        return {"workflow_id": workflow_id, "ui_schema": None}
    return {"workflow_id": workflow_id, "ui_schema": schema}


@router.post("/{workflow_id}/ui-schema/generate")
async def generate_workflow_ui_schema_api(
    workflow_id: str, request: Request = None
) -> dict[str, Any]:
    """Generate UI schema from first deployment and contract; store and return."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
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


@router.post("/{workflow_id}/deploy/prepare")
def prepare_deploy_api(
    workflow_id: str,
    request: Request,
    body: PrepareDeployBody | None = Body(None),
    chain_id: int | None = None,
) -> dict[str, Any]:
    """Compile first contract and return deploy payload for client to sign. Mainnet guarded."""
    from mainnet_guard import check_mainnet_guard, is_mainnet

    chain_id = chain_id if chain_id is not None else get_default_chain_id()
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    assert_workflow_owner(w, request)
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
    except Exception:
        logger.exception(
            "[orchestrator] compile request failed workflow_id=%s", workflow_id
        )
        return {
            "workflow_id": workflow_id,
            "error": "Compilation service request failed. Check logs for details.",
            "chainId": chain_id,
        }
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


@router.post("/{workflow_id}/deploy/approve")
@limiter.limit(DEPLOY_LIMIT)
def deploy_approve_api(
    workflow_id: str,
    background_tasks: BackgroundTasks,
    body: DeployApproveBody = DeployApproveBody(api_keys=None),
    request: Request = None,
) -> dict[str, Any]:
    """Approve deploy after Guardian; resume pipeline to create deploy plans."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
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


@router.post("/{workflow_id}/deploy/complete")
def complete_deploy_api(
    workflow_id: str, body: DeployCompleteBody, request: Request = None
) -> dict[str, Any]:
    """Record deployment from client and persist to workflow."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    deployment: dict[str, Any] = {
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


@router.post("/{workflow_id}/clarify")
def clarify_workflow_api(
    workflow_id: str, body: ClarifyBody, request: Request = None
) -> dict[str, Any]:
    """Persist user clarification message on workflow and return updated clarification list."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
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


@router.post("/{workflow_id}/cancel")
def cancel_workflow_api(workflow_id: str, request: Request = None) -> dict[str, Any]:
    """Mark workflow cancelled if still running."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    if w.get("status") == "running" or w.get("status") == "building":
        update_workflow(workflow_id, status="cancelled")
    return {"workflow_id": workflow_id, "status": "cancelled"}


class RecoveryReasonBody(BaseModel):
    reason: str = ""


@router.post("/{workflow_id}/quarantine")
def quarantine_workflow_api(
    workflow_id: str,
    body: RecoveryReasonBody,
    request: Request = None,
) -> dict[str, Any]:
    """Fail-closed: mark workflow failed and record quarantine reason."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    reason = (body.reason or "").strip() or "quarantined"
    msg = f"Quarantined: {reason}"
    update_workflow(
        workflow_id,
        status="failed",
        error=msg,
        metadata_merge={
            "quarantine_reason": reason,
            "quarantined_at": datetime.now(UTC).isoformat(),
        },
    )
    if db.is_configured():
        db.update_run(workflow_id, status="failed", error_message=msg)
    return {"workflow_id": workflow_id, "status": "failed"}


@router.post("/{workflow_id}/rollback")
def rollback_workflow_api(
    workflow_id: str,
    body: RecoveryReasonBody,
    request: Request = None,
) -> dict[str, Any]:
    """Record rollback request; workflow becomes cancelled."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    reason = (body.reason or "").strip() or "rollback_requested"
    msg = f"Rollback: {reason}"
    update_workflow(
        workflow_id,
        status="cancelled",
        metadata_merge={
            "rollback_reason": reason,
            "rollback_at": datetime.now(UTC).isoformat(),
        },
    )
    if db.is_configured():
        db.update_run(workflow_id, status="cancelled", error_message=msg)
    return {"workflow_id": workflow_id, "status": "cancelled"}


@router.post("/{workflow_id}/retry")
def retry_workflow_api(workflow_id: str, request: Request) -> dict[str, Any]:
    """Re-enqueue pipeline for failed or cancelled workflows with stored intent."""
    import queue_client as _queue

    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    assert_workflow_owner(w, request)
    st = (w.get("status") or "").lower()
    if st not in ("failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="Retry is only allowed for failed or cancelled workflows",
        )
    nlp_input = (w.get("intent") or "").strip()
    if not nlp_input:
        raise HTTPException(
            status_code=400,
            detail="Workflow has no stored intent to retry",
        )
    user_id = w.get("user_id") or ""
    project_id = w.get("project_id") or workflow_id
    api_keys = _get_keys_for_run(user_id, DEFAULT_WORKSPACE)
    if not api_keys:
        raise HTTPException(
            status_code=422,
            detail="LLM API keys are required. Add keys in Settings.",
        )
    meta = w.get("metadata") or w.get("meta_data") or {}
    pipeline_id = meta.get("pipeline_id") if isinstance(meta, dict) else None
    if not pipeline_id:
        pipeline_id = DEFAULT_PIPELINE_ID
    template_id = w.get("template_id")
    agent_session_jwt = _create_agent_session_jwt_if_configured(
        user_id, workflow_id, api_keys
    )
    request_id = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    ).strip() or None
    prev_status = w.get("status") or "failed"
    prev_error = w.get("error")
    update_workflow(workflow_id, status="building", error=None)
    job_payload = {
        "workflow_id": workflow_id,
        "user_id": user_id,
        "project_id": project_id,
        "nlp_input": nlp_input,
        "api_keys": dict(api_keys),
        "pipeline_id": pipeline_id,
        "agent_session_jwt": agent_session_jwt,
        "template_id": template_id,
        "request_id": request_id,
        "auto_approve": bool(w.get("auto_approve")),
        "network": (w.get("network") or "") or "",
    }
    queued = _queue.enqueue(job_payload)
    if not queued:
        update_workflow(workflow_id, status=prev_status, error=prev_error)
        if _queue.QUEUE_ENABLED:
            raise HTTPException(
                status_code=503,
                detail="Pipeline queue unavailable. Try again shortly.",
            )
        raise HTTPException(
            status_code=501,
            detail="Pipeline queue not configured. Set QUEUE_ENABLED=1 and REDIS_URL.",
        )
    return {"workflow_id": workflow_id, "status": "running"}


# Streaming router (separate prefix)
streaming_router = APIRouter(
    prefix="/api/v1/streaming/workflows", tags=["workflows", "streaming"]
)


@streaming_router.get("/{workflow_id}/code")
def stream_workflow_code_api(
    workflow_id: str, request: Request = None
) -> StreamingResponse:
    """SSE stream of workflow contract source for Studio code viewer."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    return StreamingResponse(
        _stream_workflow_code_sse(workflow_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@streaming_router.get("/{workflow_id}/discussion")
def stream_agent_discussion_api(
    workflow_id: str, request: Request = None
) -> StreamingResponse:
    """SSE stream of agent discussion events for real-time visibility."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    return StreamingResponse(
        _stream_agent_discussion_sse(workflow_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
