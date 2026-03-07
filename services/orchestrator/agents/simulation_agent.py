"""Simulation agent: call simulation provider per deployment, persist results, set passed."""
from providers import get_simulation_provider
from db import insert_simulation, is_configured

# Placeholder from-address for simulation (contract creation)
SIM_FROM_PLACEHOLDER = "0x0000000000000000000000000000000000000001"


async def run_tenderly_simulations(
    contracts: dict,
    spec: dict,
    chains: list,
    deployments: list | None = None,
    run_id: str = "",
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

        try:
            result = await get_simulation_provider().simulate(
                network=network,
                from_address=SIM_FROM_PLACEHOLDER,
                data=data,
                value="0",
            )
        except Exception as e:
            result = {"success": False, "error": str(e), "gasUsed": 0}

        error_message = str(result.get("error") or "")
        tenderly_disabled = "Tenderly not configured" in error_message or "TENDERLY_API_KEY not configured" in error_message

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

        if is_configured() and run_id:
            insert_simulation(
                run_id=run_id,
                network=network,
                from_address=SIM_FROM_PLACEHOLDER,
                success=result.get("success", False) and not tenderly_disabled,
                gas_used=result.get("gasUsed"),
                error_message=result.get("error"),
                raw_result=result,
            )

    return {"simulations": simulations, "passed": passed}
