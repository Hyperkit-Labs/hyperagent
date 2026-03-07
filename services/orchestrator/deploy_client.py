"""Call deploy service to get deploy plan. Delegates to DeployProvider."""
from providers import get_deploy_provider


async def get_deploy_plan(
    chain_id: int,
    bytecode: str,
    abi: list,
    constructor_args: list | None = None,
) -> dict:
    """POST /deploy; returns plan with rpcUrl, explorerUrl, bytecode, abi, constructorArgs."""
    return await get_deploy_provider().get_deploy_plan(
        chain_id=chain_id,
        bytecode=bytecode,
        abi=abi,
        constructor_args=constructor_args,
    )
