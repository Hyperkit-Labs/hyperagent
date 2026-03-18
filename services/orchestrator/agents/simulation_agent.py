"""Simulation agent: call simulation provider per deployment, persist results, set passed."""

from __future__ import annotations

import os

from circuit_breaker import CircuitOpenError, get_breaker
from db import insert_simulation, is_configured
from providers import get_simulation_provider

_SIM_BREAKER_NAME = "simulation_service"

SIM_FROM_ADDRESS = "0x0000000000000000000000000000000000000001"

# Layer 5 Security: when true, pipeline fails if Tenderly is not configured (fail-closed).
TENDERLY_SIMULATION_REQUIRED = os.environ.get(
    "TENDERLY_SIMULATION_REQUIRED", "false"
).strip().lower() in ("1", "true", "yes")


async def run_tenderly_simulations(
    contracts: dict,
    spec: dict,
    chains: list,
    deployments: list | None = None,
    run_id: str = "",
    design_rationale: str = "",
) -> dict:
    """
    For each deployment with a plan, simulate contract creation; persist to Supabase.
    Returns { simulations: list, passed: bool }.
    """
    deployments = deployments or []
    simulations: list[dict] = []
    passed = True

    for dep in deployments:
        plan = dep.get("plan") if isinstance(dep.get("plan"), dict) else dep
        if not plan or not plan.get("bytecode"):
            continue
        chain_id = dep.get("chain_id") or plan.get("chainId")
        if chain_id is None:
            continue
        network = str(chain_id)
        data = plan.get("bytecode", "")

        breaker = get_breaker(_SIM_BREAKER_NAME)
        try:
            if not breaker.can_execute():
                raise CircuitOpenError(f"Circuit {_SIM_BREAKER_NAME} is open")
            result = await get_simulation_provider().simulate(
                network=network,
                from_address=SIM_FROM_ADDRESS,
                data=data,
                value="0",
                design_rationale=design_rationale,
            )
            breaker.record_success()
        except CircuitOpenError as e:
            result = {"success": False, "error": str(e), "gasUsed": 0}
        except Exception as e:
            breaker.record_failure()
            result = {"success": False, "error": str(e), "gasUsed": 0}

        error_message = str(result.get("error") or "")
        tenderly_disabled = (
            "Tenderly not configured" in error_message
            or "TENDERLY_API_KEY not configured" in error_message
        )

        sim_record = {
            "success": result.get("success", False),
            "gasUsed": result.get("gasUsed", 0),
            "chain_id": chain_id,
            "contract_name": dep.get("contract_name", ""),
        }
        if tenderly_disabled:
            sim_record["skipped"] = True
            sim_record["reason"] = "tenderly_disabled"
        simulations.append(sim_record)
        if not result.get("success", False) and not tenderly_disabled:
            passed = False
        if tenderly_disabled and TENDERLY_SIMULATION_REQUIRED:
            passed = False

        if is_configured() and run_id:
            insert_simulation(
                run_id=run_id,
                network=network,
                from_address=SIM_FROM_ADDRESS,
                success=result.get("success", False) and not tenderly_disabled,
                gas_used=result.get("gasUsed"),
                error_message=result.get("error"),
                raw_result=result,
            )

    return {"simulations": simulations, "passed": passed}


async def run_tenderly_simulations_bundle(
    deployments: list[dict],
    run_id: str = "",
) -> dict:
    """
    Tenderly Bundled Simulations: deploy + init/first-interaction in one atomic block.
    Use when deployment plan includes init_txs (e.g. initialize() call after deploy).
    Each deployment with plan.init_txs becomes one bundle: [deploy_tx, init_tx, ...].
    init_txs items must include "to" (deployed contract address) for post-deploy calls;
    the deploy step should compute the CREATE address when building the plan.
    Returns { simulations: list, passed: bool }.
    """
    deployments = deployments or []
    simulations: list[dict] = []
    passed = True
    provider = get_simulation_provider()

    for dep in deployments:
        plan = dep.get("plan") if isinstance(dep.get("plan"), dict) else dep
        if not plan or not plan.get("bytecode"):
            continue
        chain_id = dep.get("chain_id") or plan.get("chainId")
        if chain_id is None:
            continue
        network = str(chain_id)
        init_txs = plan.get("init_txs") or []

        bundle_txs = [
            {
                "network_id": network,
                "from": SIM_FROM_ADDRESS,
                "input": plan.get("bytecode", ""),
                "value": "0",
            }
        ]
        for itx in init_txs:
            if isinstance(itx, dict) and itx.get("data"):
                bundle_txs.append({
                    "network_id": network,
                    "from": itx.get("from", SIM_FROM_ADDRESS),
                    "to": itx.get("to"),
                    "input": itx["data"],
                    "value": itx.get("value", "0"),
                })

        if len(bundle_txs) == 1:
            result = await provider.simulate(
                network=network,
                from_address=SIM_FROM_ADDRESS,
                data=plan.get("bytecode", ""),
                value="0",
            )
        else:
            try:
                result = await provider.simulate_bundle(
                    simulations=[{
                        "network_id": tx["network_id"],
                        "from": tx["from"],
                        "to": tx.get("to"),
                        "input": tx["input"],
                        "value": tx.get("value", "0"),
                    } for tx in bundle_txs]
                )
            except Exception as e:
                result = {"success": False, "error": str(e), "gasUsed": 0}

        error_message = str(result.get("error") or "")
        tenderly_disabled = (
            "Tenderly not configured" in error_message
            or "TENDERLY_API_KEY not configured" in error_message
        )

        sim_record = {
            "success": result.get("success", False),
            "gasUsed": result.get("gasUsed", 0),
            "chain_id": chain_id,
            "contract_name": dep.get("contract_name", ""),
            "bundle": len(bundle_txs) > 1,
        }
        if tenderly_disabled:
            sim_record["skipped"] = True
            sim_record["reason"] = "tenderly_disabled"
        simulations.append(sim_record)
        if not result.get("success", False) and not tenderly_disabled:
            passed = False
        if tenderly_disabled and TENDERLY_SIMULATION_REQUIRED:
            passed = False

        if is_configured() and run_id:
            insert_simulation(
                run_id=run_id,
                network=network,
                from_address=SIM_FROM_ADDRESS,
                success=result.get("success", False) and not tenderly_disabled,
                gas_used=result.get("gasUsed"),
                error_message=result.get("error"),
                raw_result=result,
            )

    return {"simulations": simulations, "passed": passed}
