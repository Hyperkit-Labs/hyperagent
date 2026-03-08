"""Deploy agent: compile contracts, get deploy plan per chain, persist to Supabase."""
from store import _ensure_contracts_dict
import logging
import os
import re

import httpx

from providers import get_deploy_provider
from db import insert_deployment, is_configured
from registries import get_timeout, get_default_chain_id
from trace_context import get_trace_headers

logger = logging.getLogger(__name__)

COMPILE_SERVICE_URL = os.environ.get("COMPILE_SERVICE_URL", "http://localhost:8004").rstrip("/")

_MD_FENCE_RE = re.compile(r"^```(?:solidity|sol)?\s*\n?", re.MULTILINE)
_MD_FENCE_END_RE = re.compile(r"\n?```\s*$", re.MULTILINE)


def _strip_markdown_fences(source: str) -> str:
    """Remove markdown code fences that LLMs sometimes wrap around Solidity output."""
    s = _MD_FENCE_RE.sub("", source)
    s = _MD_FENCE_END_RE.sub("", s)
    return s.strip()


async def _compile_contract(source: str, contract_name: str, framework: str = "hardhat") -> dict | None:
    """Return { bytecode, abi } or None on failure."""
    clean_source = _strip_markdown_fences(source)
    headers = get_trace_headers()
    async with httpx.AsyncClient(timeout=get_timeout("deploy")) as client:
        r = await client.post(
            f"{COMPILE_SERVICE_URL}/compile",
            json={"contractCode": clean_source, "framework": framework},
            headers=headers,
        )
        if r.status_code != 200:
            logger.warning("[deploy] compile HTTP %s for %s", r.status_code, contract_name)
            return None
        data = r.json()
        if not data.get("success") or not data.get("bytecode"):
            errors = data.get("errors") or []
            msgs = [e.get("message", "")[:200] for e in errors[:3]] if errors else ["unknown"]
            logger.warning("[deploy] compile failed for %s: %s", contract_name, "; ".join(msgs))
            return None
        return {"bytecode": data["bytecode"], "abi": data.get("abi") or []}


def _chain_ids_from_spec(chains: list) -> list[int]:
    """Extract chain_id list from spec chains."""
    out = []
    for c in chains or []:
        if isinstance(c, dict):
            cid = c.get("chain_id") or c.get("id")
            if cid is not None:
                out.append(int(cid))
        elif isinstance(c, int):
            out.append(c)
    return out if out else [get_default_chain_id()]


def _extract_erc20_constructor_args(spec: dict, oz_wizard_options: dict | None = None) -> list:
    """Extract constructor args (name, symbol, initialSupply) for ERC20 from wizard_options."""
    opts = dict(oz_wizard_options or {})
    if isinstance(spec.get("wizard_options"), dict):
        opts.update(spec["wizard_options"])
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


async def deploy_contracts(
    contracts: dict,
    chains: list,
    spec: dict,
    run_id: str = "",
    project_id: str = "",
    oz_wizard_options: dict | None = None,
) -> list:
    """
    Compile each contract, get deploy plan per chain, persist to Supabase.
    Returns list of deployment records (with id, plan, chain_id, contract_name).
    For multi-contract, deploys in dict iteration order; deployment_order set by index.
    """
    deployments: list[dict] = []
    chain_ids = _chain_ids_from_spec(chains)
    framework = spec.get("framework") or "hardhat"

    contracts = _ensure_contracts_dict(contracts)
    contract_items = [(n, s) for n, s in contracts.items() if n.endswith(".sol") and isinstance(s, str)]
    logger.info("[deploy] chain_ids=%s contracts=%s", chain_ids, [n for n, _ in contract_items])
    for order, (name, source) in enumerate(contract_items):
        contract_name = name.replace(".sol", "")
        compiled = await _compile_contract(source, contract_name, framework)
        if not compiled:
            logger.warning("[deploy] skipping %s: compile returned None", contract_name)
            continue
        bytecode = compiled["bytecode"]
        abi = compiled["abi"]
        logger.info("[deploy] compiled %s bytecode=%d bytes abi=%d entries", contract_name, len(bytecode), len(abi))

        constructor_args: list = []
        if order == 0 and str(spec.get("token_type", "")).upper() == "ERC20":
            constructor_args = _extract_erc20_constructor_args(spec, oz_wizard_options)

        for chain_id in chain_ids:
            try:
                plan = await get_deploy_provider().get_deploy_plan(chain_id, bytecode, abi, constructor_args)
            except Exception as exc:
                logger.warning("[deploy] deploy plan failed chain=%s contract=%s: %s", chain_id, contract_name, exc)
                continue
            network_name = str(chain_id)
            if isinstance(plan.get("explorerUrl"), str):
                network_name = plan.get("network_name", network_name)

            if is_configured() and run_id and project_id:
                row = insert_deployment(
                    run_id=run_id,
                    project_id=project_id,
                    chain_id=chain_id,
                    contract_name=contract_name,
                    plan=plan,
                    network_name=network_name,
                    deployment_order=order,
                )
                if row:
                    deployments.append({**row, "plan": plan})
                else:
                    deployments.append({"chain_id": chain_id, "contract_name": contract_name, "plan": plan})
            else:
                deployments.append({"chain_id": chain_id, "contract_name": contract_name, "plan": plan})

    logger.info("[deploy] finished: %d deployment(s)", len(deployments))
    return deployments
