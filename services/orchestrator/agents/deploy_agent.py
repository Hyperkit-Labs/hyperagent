"""Deploy agent: compile contracts, get deploy plan per chain, persist to Supabase."""
import logging
import os
import re

import httpx

from providers import get_deploy_provider
from db import insert_deployment, is_configured
from registries import get_timeout

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
    async with httpx.AsyncClient(timeout=get_timeout("deploy")) as client:
        r = await client.post(
            f"{COMPILE_SERVICE_URL}/compile",
            json={"contractCode": clean_source, "framework": framework},
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
    """Extract chain_id list from spec chains (e.g. [{"chain_id": 8453}, {"id": 1}])."""
    out = []
    for c in chains or []:
        if isinstance(c, dict):
            cid = c.get("chain_id") or c.get("id")
            if cid is not None:
                out.append(int(cid))
        elif isinstance(c, int):
            out.append(c)
    return out if out else [8453]


async def deploy_contracts(
    contracts: dict,
    chains: list,
    spec: dict,
    run_id: str = "",
    project_id: str = "",
) -> list:
    """
    Compile each contract, get deploy plan per chain, persist to Supabase.
    Returns list of deployment records (with id, plan, chain_id, contract_name).
    """
    deployments: list[dict] = []
    chain_ids = _chain_ids_from_spec(chains)
    framework = spec.get("framework") or "hardhat"

    logger.info("[deploy] chain_ids=%s contracts=%s", chain_ids, list((contracts or {}).keys()))
    for name, source in (contracts or {}).items():
        if not name.endswith(".sol") or not isinstance(source, str):
            continue
        contract_name = name.replace(".sol", "")
        compiled = await _compile_contract(source, contract_name, framework)
        if not compiled:
            logger.warning("[deploy] skipping %s: compile returned None", contract_name)
            continue
        bytecode = compiled["bytecode"]
        abi = compiled["abi"]
        logger.info("[deploy] compiled %s bytecode=%d bytes abi=%d entries", contract_name, len(bytecode), len(abi))

        for chain_id in chain_ids:
            try:
                plan = await get_deploy_provider().get_deploy_plan(chain_id, bytecode, abi, [])
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
                )
                if row:
                    deployments.append({**row, "plan": plan})
                else:
                    deployments.append({"chain_id": chain_id, "contract_name": contract_name, "plan": plan})
            else:
                deployments.append({"chain_id": chain_id, "contract_name": contract_name, "plan": plan})

    logger.info("[deploy] finished: %d deployment(s)", len(deployments))
    return deployments
