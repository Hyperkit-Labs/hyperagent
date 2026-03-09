"""Call simulation service (Tenderly). Delegates to SimulationProvider."""
from providers import get_simulation_provider


async def simulate_tx(
    network: str,
    from_address: str,
    data: str,
    to_address: str | None = None,
    value: str = "0",
) -> dict:
    """POST /simulate; returns { success, gasUsed, traces, simulationUrl } or error."""
    return await get_simulation_provider().simulate(
        network=network,
        from_address=from_address,
        data=data,
        to_address=to_address,
        value=value,
    )
