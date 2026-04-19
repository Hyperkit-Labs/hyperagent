"""Simulation agent: call simulation provider per deployment, persist results, set passed.

Simulation fallback for non-Tenderly chains (SKALE Base):
  When TENDERLY_API_KEY is not set OR capabilities.yaml marks tenderly: false for the
  target chain, the agent falls back to eth_estimateGas against the chain's own RPC.
  This verifies the bytecode is deployable (correct constructor ABI, no revert at
  creation time) without a full Tenderly fork. Enable with SIMULATION_RPC_FALLBACK=1
  (default: 1 — the SKALE deploy path would otherwise hard-fail every pipeline run).
"""

from __future__ import annotations

import logging
import os

import httpx
from circuit_breaker import CircuitOpenError, get_breaker
from db import insert_simulation, is_configured
from providers import get_simulation_provider

_SIM_BREAKER_NAME = "simulation_service"

logger = logging.getLogger(__name__)

SIM_FROM_ADDRESS = "0x0000000000000000000000000000000000000001"

# Layer 5 Security: when true (default), pipeline fails when Tenderly is not configured.
# Setting this to false makes Tenderly-missing runs pass simulation — NOT recommended for production.
TENDERLY_SIMULATION_REQUIRED = os.environ.get(
    "TENDERLY_SIMULATION_REQUIRED", "true"
).strip().lower() in ("1", "true", "yes")

# When Tenderly is unavailable for a chain (e.g. SKALE), fall back to eth_estimateGas
# against the chain's own RPC. This is weaker than a Tenderly fork but still validates
# bytecode deployability. Disable with SIMULATION_RPC_FALLBACK=0.
SIMULATION_RPC_FALLBACK = os.environ.get(
    "SIMULATION_RPC_FALLBACK", "1"
).strip().lower() not in ("0", "false", "no")

if not TENDERLY_SIMULATION_REQUIRED:
    logger.warning(
        "[simulation] TENDERLY_SIMULATION_REQUIRED=false. "
        "Runs where Tenderly is not configured will pass the simulation gate. "
        "This weakens the predeploy safety check and is NOT recommended in production."
    )

# ---------------------------------------------------------------------------
# Chain RPC registry for fallback simulation
# Must stay in sync with infra/registries/network/chains.yaml
# ---------------------------------------------------------------------------
_CHAIN_RPC_FALLBACK: dict[int, str] = {
    1187947933: "https://skale-base.skalenodes.com/v1/base",
    324705682: "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha",
}

# Chains where Tenderly is documented as not supported.
# Fallback simulation runs for these even when TENDERLY_SIMULATION_REQUIRED=true.
_TENDERLY_UNSUPPORTED_CHAINS: frozenset[int] = frozenset({1187947933, 324705682})


async def _simulate_via_rpc(chain_id: int, bytecode: str) -> dict:
    """Fallback simulation for chains without Tenderly support.

    Uses eth_estimateGas with the contract bytecode against the chain's own RPC.
    Validates that:
      1. The bytecode is syntactically valid EVM bytecode (RPC accepts it)
      2. The constructor does not revert (estimateGas returns a value)
      3. The chain is reachable

    This is not a full Tenderly fork — state-dependent constructor logic (e.g.
    reading on-chain prices) may not be fully validated. High-risk contracts
    still require a Tenderly Virtual TestNet or equivalent.
    """
    rpc_url = _CHAIN_RPC_FALLBACK.get(chain_id)
    if not rpc_url:
        # Try the chain registry for dynamic lookup
        try:
            from registries import get_chain_rpc_url_list

            rpc_list = get_chain_rpc_url_list(str(chain_id))
            rpc_url = rpc_list[0] if rpc_list else None
        except Exception:
            pass

    if not rpc_url:
        return {
            "success": False,
            "error": f"No RPC URL found for chain {chain_id} — cannot run fallback simulation",
            "gasUsed": 0,
            "rpc_simulated": True,
        }

    breaker = get_breaker("simulation_rpc")
    if not breaker.can_execute():
        return {
            "success": False,
            "error": "RPC simulation circuit open",
            "gasUsed": 0,
            "rpc_simulated": True,
        }

    async def _do_rpc() -> dict:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                rpc_url,
                json={
                    "jsonrpc": "2.0",
                    "method": "eth_estimateGas",
                    "params": [{"from": SIM_FROM_ADDRESS, "data": bytecode}],
                    "id": 1,
                },
                headers={"Content-Type": "application/json"},
            )
            body = resp.json()
            if "result" in body:
                gas_hex = body["result"]
                gas_used = int(gas_hex, 16)
                logger.info(
                    "[simulation] RPC fallback: chain=%d estimateGas=%d",
                    chain_id,
                    gas_used,
                )
                return {
                    "success": True,
                    "gasUsed": gas_used,
                    "rpc_simulated": True,
                    "simulationUrl": None,
                    "note": f"RPC eth_estimateGas fallback (Tenderly not available for chain {chain_id})",
                }
            error = body.get("error", {})
            msg = error.get("message") if isinstance(error, dict) else str(error)
            logger.warning(
                "[simulation] RPC fallback failed: chain=%d err=%s", chain_id, msg
            )
            return {
                "success": False,
                "error": f"RPC simulation: {msg}",
                "gasUsed": 0,
                "rpc_simulated": True,
            }

    try:
        return await breaker.call(_do_rpc)
    except CircuitOpenError:
        return {
            "success": False,
            "error": "RPC simulation circuit open",
            "gasUsed": 0,
            "rpc_simulated": True,
        }
    except Exception as exc:
        logger.warning(
            "[simulation] RPC fallback exception: chain=%d %s", chain_id, exc
        )
        return {
            "success": False,
            "error": f"RPC simulation unavailable: {exc}",
            "gasUsed": 0,
            "rpc_simulated": True,
        }


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
            or (chain_id is not None and int(chain_id) in _TENDERLY_UNSUPPORTED_CHAINS)
        )

        # For chains where Tenderly is not supported, run the RPC fallback
        # before deciding pass/fail. This prevents every SKALE pipeline from
        # hard-failing the simulation gate with "Tenderly not configured".
        if tenderly_disabled and SIMULATION_RPC_FALLBACK and data:
            cid = int(chain_id) if chain_id else 0
            logger.info(
                "[simulation] Tenderly unavailable for chain %d — running RPC fallback",
                cid,
            )
            result = await _simulate_via_rpc(cid, data)
            tenderly_disabled = False  # RPC fallback ran — treat as a real result
            error_message = str(result.get("error") or "")

        sim_record = {
            "success": result.get("success", False),
            "gasUsed": result.get("gasUsed", 0),
            "chain_id": chain_id,
            "contract_name": dep.get("contract_name", ""),
        }
        if result.get("rpc_simulated"):
            sim_record["rpc_simulated"] = True
            sim_record["note"] = result.get("note", "RPC fallback")
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
                bundle_txs.append(
                    {
                        "network_id": network,
                        "from": itx.get("from", SIM_FROM_ADDRESS),
                        "to": itx.get("to"),
                        "input": itx["data"],
                        "value": itx.get("value", "0"),
                    }
                )

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
                    simulations=[
                        {
                            "network_id": tx["network_id"],
                            "from": tx["from"],
                            "to": tx.get("to"),
                            "input": tx["input"],
                            "value": tx.get("value", "0"),
                        }
                        for tx in bundle_txs
                    ]
                )
            except Exception as e:
                result = {"success": False, "error": str(e), "gasUsed": 0}

        error_message = str(result.get("error") or "")
        tenderly_disabled = (
            "Tenderly not configured" in error_message
            or "TENDERLY_API_KEY not configured" in error_message
            or (chain_id is not None and int(chain_id) in _TENDERLY_UNSUPPORTED_CHAINS)
        )

        # RPC fallback for non-Tenderly chains (SKALE). Bundle mode: simulate
        # only the deploy step (index 0) — init_txs depend on on-chain state
        # that RPC won't have. Mark the bundle result accordingly.
        if tenderly_disabled and SIMULATION_RPC_FALLBACK and plan.get("bytecode"):
            cid = int(chain_id) if chain_id else 0
            logger.info(
                "[simulation] Tenderly unavailable for chain %d — running RPC fallback (bundle mode)",
                cid,
            )
            result = await _simulate_via_rpc(cid, plan.get("bytecode", ""))
            if len(bundle_txs) > 1:
                result["note"] = (
                    result.get("note", "")
                    + " (bundle: only deploy step simulated via RPC; init_txs skipped)"
                )
            tenderly_disabled = False

        sim_record = {
            "success": result.get("success", False),
            "gasUsed": result.get("gasUsed", 0),
            "chain_id": chain_id,
            "contract_name": dep.get("contract_name", ""),
            "bundle": len(bundle_txs) > 1,
        }
        if result.get("rpc_simulated"):
            sim_record["rpc_simulated"] = True
            sim_record["note"] = result.get("note", "RPC fallback")
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
