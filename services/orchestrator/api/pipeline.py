"""
Pipeline API: POST /generate - main workflow creation and pipeline entry.
"""

import logging
import os
import uuid
from typing import Any

import credits_supabase
import db
from fastapi import APIRouter, HTTPException, Request
import queue_client as _queue
from pydantic import BaseModel, Field

from .common import (
    _create_agent_session_jwt_if_configured,
    _get_keys_for_run,
    _log_byok_event,
    _run_status_for_store,
)
from input_guardrail import validate_input as guardrail_validate_input
from llm_keys_store import DEFAULT_WORKSPACE
from registries import DEFAULT_PIPELINE_ID, get_x402_enabled
from store import MAX_INTENT_LENGTH, create_workflow, update_workflow
from trace_context import set_request_id
from workflow import run_pipeline

logger = logging.getLogger(__name__)

import payments_supabase

CREDITS_PER_RUN = float(os.environ.get("CREDITS_PER_RUN", "7"))
CREDITS_PER_USD = float(os.environ.get("CREDITS_PER_USD", "10"))


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
                request_id=request_id,
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
        except Exception as clear_err:
            logger.debug("[pipeline] api_keys.clear() failed: %s", clear_err)


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


router = APIRouter(prefix="/api/v1/workflows", tags=["pipeline"])


@router.post("/generate")
def workflows_generate(
    body: CreateWorkflowBody,
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
    job_payload = {
        "workflow_id": workflow_id,
        "user_id": user_id,
        "project_id": project_id,
        "nlp_input": body.nlp_input,
        "api_keys": dict(api_keys),
        "pipeline_id": body.pipeline_id,
        "agent_session_jwt": agent_session_jwt,
        "template_id": body.template_id,
        "request_id": request_id,
        "auto_approve": body.auto_approve,
        "network": body.network or "",
    }
    queued = _queue.enqueue(job_payload)
    if not queued:
        if _queue.QUEUE_ENABLED:
            raise HTTPException(
                status_code=503,
                detail="Pipeline queue unavailable. Set REDIS_URL and ensure the worker is consuming jobs.",
            )
        raise HTTPException(
            status_code=503,
            detail="Pipeline requires queue. Set QUEUE_ENABLED=1 and REDIS_URL. Run worker: python -m worker",
        )
    logger.info("[generate] queued pipeline job workflow_id=%s", workflow_id)
    return {"workflow_id": workflow_id, "status": "running"}
