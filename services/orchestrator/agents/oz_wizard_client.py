"""OpenZeppelin Contracts Wizard client. Calls agent-runtime /agents/codegen/oz-wizard."""
import os
import httpx

from registries import get_timeout

AGENT_RUNTIME_URL = os.environ.get("AGENT_RUNTIME_URL", "http://localhost:4001")


async def generate_contracts_oz(
    kind: str,
    options: dict,
    agent_session_jwt: str | None = None,
) -> dict[str, str]:
    """Generate contract source via OZ Wizard. Returns { filename: source }."""
    headers = {}
    if agent_session_jwt:
        headers["X-Agent-Session"] = agent_session_jwt
    async with httpx.AsyncClient(timeout=get_timeout("oz_wizard")) as client:
        r = await client.post(
            f"{AGENT_RUNTIME_URL.rstrip('/')}/agents/codegen/oz-wizard",
            json={"kind": kind, "options": options},
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and all(isinstance(v, str) for v in data.values()):
            return data
        if isinstance(data, dict) and "contract" in data:
            return {"Contract.sol": data["contract"]}
        return {"Contract.sol": str(data)}
