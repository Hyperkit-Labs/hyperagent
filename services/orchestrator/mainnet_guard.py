"""
Mainnet deployment guard: block deploy payload for mainnet unless simulation passed
and no high/critical audit findings. Catches catastrophic mistakes before mainnet.
Mainnet chain IDs from registry (network/chains.yaml category != testnet); env MAINNET_CHAIN_IDS overrides.
"""

from __future__ import annotations

from registries import get_mainnet_chain_ids


def is_mainnet(chain_id: int) -> bool:
    return chain_id in get_mainnet_chain_ids()


def check_mainnet_guard(workflow: dict, chain_id: int) -> tuple[bool, str]:
    """
    Return (allowed, reason). For mainnet chain_id, require simulation passed
    and no high/critical findings. For testnet, always allowed.
    """
    if not is_mainnet(chain_id):
        return True, ""

    sim_passed = workflow.get("simulation_passed")
    if not sim_passed:
        return (
            False,
            "Mainnet deploy blocked: Tenderly simulation did not pass for this workflow.",
        )

    sim_results = workflow.get("simulation_results") or []
    if isinstance(sim_results, dict):
        sim_list = sim_results.get("simulations", [])
    else:
        sim_list = sim_results if isinstance(sim_results, list) else []
    chain_sim_ok = any(
        (s.get("chain_id") == chain_id or s.get("chain_id") == str(chain_id))
        and s.get("success")
        for s in sim_list
    )
    if not chain_sim_ok and sim_list:
        return False, "Mainnet deploy blocked: no successful simulation for this chain."
    if not chain_sim_ok:
        return False, "Mainnet deploy blocked: no simulation results for this chain."

    findings = workflow.get("audit_findings") or []
    for f in findings:
        sev = (f.get("severity") or "info").lower()
        if sev in ("high", "critical"):
            return (
                False,
                "Mainnet deploy blocked: audit has high or critical findings. Resolve or deploy to testnet.",
            )

    return True, ""
