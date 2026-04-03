"""
Runs, registry, and misc API: runs, security, networks, tokens, platform,
presets, blueprints, templates, logs, agents, contracts, approve_spec,
quick-demo, debug-sandbox, llm-keys.
"""

import json
import logging
import os
import time
from typing import Any

import db
import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from registries import (
    get_chain_id_by_network_slug,
    get_chain_rpc_explorer,
    get_networks_for_api,
    get_stablecoins_by_chain,
    get_templates_for_api,
)
from store import get_workflow, update_workflow
from workflow import run_pipeline

from .common import (
    _create_agent_session_jwt_if_configured,
    _get_keys_for_run,
    _run_status_for_store,
    assert_workflow_owner,
)
from llm_keys_store import DEFAULT_WORKSPACE

logger = logging.getLogger(__name__)

SANDBOX_API_URL = (
    os.environ.get("SANDBOX_API_URL") or os.environ.get("OPENSANDBOX_API_URL") or ""
).rstrip("/")
SANDBOX_API_KEY = (
    os.environ.get("SANDBOX_API_KEY", "").strip()
    or os.environ.get("OPENSANDBOX_API_KEY", "").strip()
)


def _has_stub_trace(steps: list[dict]) -> bool:
    """True when any step has stub blob_id (IPFS not configured)."""
    for s in steps:
        bid = s.get("trace_blob_id") or ""
        if isinstance(bid, str) and bid.startswith("stub:"):
            return True
    return False


# Runs router
runs_router = APIRouter(prefix="/api/v1/runs", tags=["runs"])


@runs_router.get("/{run_id}")
def get_run_api(run_id: str, request: Request = None) -> dict[str, Any]:
    """Return run detail; run_id is workflow_id."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    if request:
        assert_workflow_owner(w, request)
    return {
        "id": w.get("workflow_id"),
        "workflow_id": w.get("workflow_id"),
        "status": w.get("status"),
        "current_stage": w.get("status"),
        "created_at": w.get("created_at"),
    }


@runs_router.get("/{run_id}/steps")
def get_run_steps_api(run_id: str, request: Request = None) -> dict[str, Any]:
    """Return step-level audit for a run. trace_verifiable: false when any step has stub blob_id."""
    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Run not found")
    if request:
        assert_workflow_owner(w, request)
    steps = db.get_steps(run_id)
    trace_verifiable = not _has_stub_trace(steps)
    return {"run_id": run_id, "steps": steps, "trace_verifiable": trace_verifiable}


def _approve_spec_impl(run_id: str, request: Request | None = None) -> dict[str, Any]:
    """Set spec_approved and resume pipeline from design node."""
    from registries import DEFAULT_PIPELINE_ID

    w = get_workflow(run_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
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
        err_msg = str(e)[:500]
        logger.exception("[approve_spec] resume failed run_id=%s", run_id)
        update_workflow(run_id, status="failed", error=err_msg)
        if db.is_configured():
            db.update_run(run_id, status="failed", error_message=err_msg)
        raise HTTPException(
            status_code=500,
            detail="Pipeline resume failed. Check logs for details.",
        )


@runs_router.patch("/{run_id}/approve_spec")
def approve_spec(run_id: str, request: Request = None) -> dict[str, Any]:
    """Set spec_approved and resume pipeline from design node."""
    return _approve_spec_impl(run_id, request)


# Legacy approve_spec (no /api/v1 prefix)
approve_spec_legacy_router = APIRouter(tags=["runs", "legacy"])


@approve_spec_legacy_router.patch("/runs/{run_id}/approve_spec")
def approve_spec_legacy(run_id: str, request: Request = None) -> dict[str, Any]:
    """Legacy path. Use PATCH /api/v1/runs/{run_id}/approve_spec."""
    return _approve_spec_impl(run_id, request)


# Security router
security_router = APIRouter(prefix="/api/v1/security", tags=["security"])


@security_router.get("/findings")
def get_security_findings_api(
    request: Request,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    run_id: str | None = None,
    limit: int = 100,
) -> dict[str, Any]:
    """Return security findings for authenticated user's runs."""
    findings = db.list_security_findings(
        wallet_user_id=x_user_id if (x_user_id and x_user_id.strip()) else None,
        run_id=run_id,
        limit=min(200, max(1, limit)),
    )
    return {"findings": findings}


# Registry router (networks, tokens, platform, presets, blueprints, templates)
registry_router = APIRouter(prefix="/api/v1", tags=["registry"])


@registry_router.get("/networks")
def get_networks_api(skale: bool = False) -> list[dict[str, Any]]:
    """Return networks from chain registry."""
    return get_networks_for_api(skale=skale)


@registry_router.get("/networks/rpc-test")
async def rpc_test_api(
    network_id: str = "", chain_id: int | None = None
) -> dict[str, Any]:
    """Test RPC connectivity by calling eth_blockNumber."""
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
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_blockNumber",
                    "params": [],
                    "id": 1,
                },
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
        return {
            "ok": False,
            "error": "Request timed out",
            "latency_ms": int((time.perf_counter() - start) * 1000),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], "latency_ms": int((time.perf_counter() - start) * 1000)}


@registry_router.get("/tokens/stablecoins")
def get_stablecoins_api() -> dict[str, dict[str, str]]:
    """Return USDC/USDT addresses per chain."""
    return get_stablecoins_by_chain()


@registry_router.get("/platform/track-record")
def get_platform_track_record_api() -> dict[str, Any]:
    """Return platform track record stats for login page. Public."""
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
            audits = audit_count
            vulnerabilities = findings_count
            researchers = researchers_count
            contracts_deployed = deployments_count
            source = "database"
            if audit_count == 0 and findings_count == 0:
                states = db.list_workflow_states(limit=500)
                if states:
                    audit_count_legacy = sum(
                        1
                        for s in states
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


@registry_router.get("/presets")
def get_presets_api() -> list[dict[str, Any]]:
    """Return presets from token template registry."""
    return [
        {"id": t["id"], "name": t.get("name", t["id"]), "description": t.get("description", "")}
        for t in get_templates_for_api()
    ]


@registry_router.get("/blueprints")
def get_blueprints_api() -> list[dict[str, Any]]:
    """Return blueprints from token template registry."""
    return [
        {"id": t["id"], "name": t.get("name", t["id"]), "description": t.get("description", "")}
        for t in get_templates_for_api()
    ]


@registry_router.get("/templates")
def get_templates_api() -> list[dict[str, Any]]:
    """Return templates from registry."""
    return get_templates_for_api()


@registry_router.get("/templates/search")
def search_templates_api(q: str = "") -> list[dict[str, Any]]:
    """Search templates by query."""
    all_t = get_templates_for_api()
    if not q or not q.strip():
        return all_t
    ql = q.lower().strip()
    return [t for t in all_t if ql in (t.get("name") or "").lower() or ql in (t.get("id") or "").lower()]


# Logs router
logs_router = APIRouter(prefix="/api/v1/logs", tags=["logs"])


@logs_router.get("")
def logs_api(page: int = 1, page_size: int = 50) -> dict[str, Any]:
    """Recent activity from run_steps. Returns empty list when Supabase not configured."""
    try:
        logs = db.get_recent_activity_logs(limit=min(page_size * 2, 100))
        total = len(logs)
        start = (page - 1) * page_size
        end = start + page_size
        page_logs = logs[start:end] if total else []
        return {"logs": page_logs, "total": total, "page": page, "page_size": page_size}
    except Exception:
        return {"logs": [], "total": 0, "page": 1, "page_size": page_size}


@logs_router.get("/services")
def logs_services_api() -> list[str]:
    """Return distinct service names from recent activity."""
    try:
        logs = db.get_recent_activity_logs(limit=100)
        services = sorted(
            {str(e.get("service", "orchestrator")) for e in logs if e.get("service")}
        )
        return services if services else ["orchestrator"]
    except Exception:
        return ["orchestrator"]


@logs_router.get("/hosts")
def logs_hosts_api() -> list[str]:
    """Return distinct log sources from run_steps and agent_logs."""
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


# Agents router
agents_router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


@agents_router.get("")
def agents_api() -> dict[str, Any]:
    """Return pipeline agents from workflow (spec, design, codegen, audit, simulation, deploy, ui_scaffold)."""
    from nodes import STEP_ORDER

    return {
        "agents": [
            {"name": name, "status": "ok", "step_index": i}
            for i, name in enumerate(STEP_ORDER)
        ]
    }


# Contracts router
contracts_router = APIRouter(prefix="/api/v1/contracts", tags=["contracts"])


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


@contracts_router.post("/read")
def contract_read_api(body: ContractReadBody) -> dict[str, Any]:
    """Contract read (view/pure) via chain RPC."""
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
        rpc_url,
        body.contract_address,
        body.abi,
        body.function_name,
        body.function_args or [],
    )
    if not ok:
        return {"success": False, "error": err or "RPC call failed"}
    return {"success": True, "result": result}


@contracts_router.post("/call")
def contract_call_api(body: ContractCallBody) -> dict[str, Any]:
    """Build unsigned transaction for contract write."""
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


# LLM keys router
llm_keys_router = APIRouter(prefix="/api/v1/workspaces/current", tags=["llm-keys"])


class LLMKeysBody(BaseModel):
    keys: dict[str, str] = Field(default_factory=dict)


class LLMKeyValidateBody(BaseModel):
    provider: str = Field(..., min_length=1, max_length=64)
    api_key: str | None = Field(None, max_length=512)


def _require_user_id_for_byok(x_user_id: str | None) -> None:
    import llm_keys_supabase
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
    request_id = (
        request.headers.get("x-request-id") or request.headers.get("X-Request-Id") or ""
    ).strip() or None
    import llm_keys_supabase
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


@llm_keys_router.get("/llm-keys")
def get_llm_keys(
    request: Request,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Return configured provider names only (no key values)."""
    import llm_keys_supabase
    from llm_keys_store import get_configured_providers

    _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        from .common import _log_byok_event
        db.ensure_wallet_user_profile(x_user_id)
        _log_byok_event("byok_access", x_user_id, "get_configured_providers")
        providers = llm_keys_supabase.get_configured_providers(x_user_id)
        _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "success", provider_count=len(providers))
        return {"configured_providers": providers}
    if llm_keys_supabase._is_configured():
        return {"configured_providers": []}
    providers = get_configured_providers(wid)
    _trace_llm_keys(request, "GET", x_user_id, x_workspace_id, "success", provider_count=len(providers))
    return {"configured_providers": providers}


@llm_keys_router.post("/llm-keys")
def post_llm_keys(
    request: Request,
    body: LLMKeysBody,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Store LLM keys for current workspace or user. Uses Supabase when X-User-Id present and configured."""
    import llm_keys_supabase
    from llm_keys_store import set_keys

    _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    if os.environ.get("ENV") == "production" and not (
        os.environ.get("LLM_KEY_ENCRYPTION_KEY") or os.environ.get("LLM_KEY_KMS_KEY_ARN")
    ):
        if x_user_id and (body.keys or {}):
            _trace_llm_keys(request, "POST", x_user_id, x_workspace_id, "503_missing_encryption_key")
            raise HTTPException(
                status_code=503,
                detail="BYOK requires LLM_KEY_ENCRYPTION_KEY or LLM_KEY_KMS_KEY_ARN in production",
            )
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        from .common import _log_byok_event
        db.ensure_wallet_user_profile(x_user_id)
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


@llm_keys_router.delete("/llm-keys")
def delete_llm_keys(
    request: Request,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Remove all LLM keys for current workspace or user."""
    import llm_keys_supabase
    from llm_keys_store import delete_keys

    _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "request_received")
    try:
        _require_user_id_for_byok(x_user_id)
    except HTTPException:
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "401_missing_x_user_id")
        raise
    wid = x_workspace_id or DEFAULT_WORKSPACE
    if x_user_id and llm_keys_supabase._is_configured():
        from .common import _log_byok_event
        _log_byok_event("byok_access", x_user_id, "delete_keys")
        llm_keys_supabase.delete_keys_for_user(x_user_id)
        _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
        return {"configured_providers": []}
    delete_keys(wid)
    _trace_llm_keys(request, "DELETE", x_user_id, x_workspace_id, "success")
    return {"configured_providers": []}


@llm_keys_router.post("/llm-keys/validate")
async def validate_llm_key(
    body: LLMKeyValidateBody,
    x_workspace_id: str | None = Header(None, alias="X-Workspace-Id"),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Validate an LLM API key by calling the provider's models endpoint."""
    import llm_keys_supabase
    from llm_keys_store import get_keys_for_pipeline

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
                msg = (j.get("error") or {}).get("message") or str(j.get("message", ""))
                if msg:
                    err_body = msg[:200]
            except Exception:
                pass
            return False, latency_ms, err_body or f"HTTP {r.status_code}"
    except httpx.TimeoutException:
        return False, int((time.perf_counter() - start) * 1000), "Request timed out"
    except Exception as e:
        return False, int((time.perf_counter() - start) * 1000), str(e)[:200]


# Quick-demo and debug-sandbox
sandbox_router = APIRouter(prefix="/api/v1", tags=["sandbox"])


class QuickDemoBody(BaseModel):
    workflow_id: str | None = None


async def _quick_demo_via_docker_sandbox(
    tarball_url: str,
    timeout_minutes: int = 30,
) -> dict[str, Any]:
    """Create sandbox via Contabo Docker Sandbox API."""
    if not SANDBOX_API_URL or not SANDBOX_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Docker sandbox not configured: set SANDBOX_API_URL and OPENSANDBOX_API_KEY",
        )
    create_url = f"{SANDBOX_API_URL}/sandbox/create"
    payload = {"tarball_url": tarball_url, "timeout_minutes": timeout_minutes, "port": 8545}
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


@sandbox_router.post("/quick-demo")
async def quick_demo_api(
    request: Request, body: QuickDemoBody | None = None
) -> dict[str, Any]:
    """Create a sandbox from workflow-generated code."""
    workflow_id = (body and body.workflow_id) or None
    if not workflow_id:
        raise HTTPException(status_code=400, detail="workflow_id required in body")
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if request:
        assert_workflow_owner(w, request)
    base = (os.environ.get("ORCHESTRATOR_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    tarball_url = f"{base}/api/v1/workflows/{workflow_id}/tarball"
    return await _quick_demo_via_docker_sandbox(tarball_url=tarball_url)


# Debug-sandbox is in workflows - add to workflows router
# We add it here to runs_registry since it's a sandbox feature
debug_sandbox_router = APIRouter(prefix="/api/v1/workflows", tags=["sandbox"])


@debug_sandbox_router.post("/{workflow_id}/debug-sandbox")
async def debug_sandbox_api(workflow_id: str, request: Request) -> dict[str, Any]:
    """Create debug sandbox for workflow. Requires SANDBOX_API_URL."""
    w = get_workflow(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    assert_workflow_owner(w, request)
    base = (os.environ.get("ORCHESTRATOR_PUBLIC_URL") or str(request.base_url)).rstrip("/")
    tarball_url = f"{base}/api/v1/workflows/{workflow_id}/tarball"
    return await _quick_demo_via_docker_sandbox(tarball_url=tarball_url)
