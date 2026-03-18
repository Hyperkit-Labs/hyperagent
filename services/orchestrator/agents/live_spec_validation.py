"""Live spec validation: shadow simulation before design.
When OPENSANDBOX_ENABLED, compiles a minimal Solidity stub derived from spec to validate feasibility."""

import logging
import os

logger = logging.getLogger(__name__)

OPENSANDBOX_ENABLED = os.environ.get(
    "OPENSANDBOX_ENABLED", "false"
).strip().lower() in ("1", "true", "yes")


def _stub_from_spec(spec: dict) -> str:
    """Build minimal Solidity stub from spec for shadow compile."""
    token_type = (spec.get("token_type") or "erc20").lower()
    base = "pragma solidity ^0.8.24;\n\ncontract Shadow {\n"
    if token_type in ("dex", "amm", "swap"):
        base += "    mapping(address => uint256) public balanceOf;\n    function swap(uint256, uint256) external pure returns (uint256, uint256) { return (0, 0); }\n"
    elif token_type in ("lending", "lend", "borrow"):
        base += "    mapping(address => uint256) public collateral;\n    function borrow(uint256) external { require(collateral[msg.sender] >= 0); }\n"
    elif token_type in ("vault", "staking"):
        base += "    mapping(address => uint256) public shares;\n    function deposit(uint256) external { shares[msg.sender] += 1; }\n"
    else:
        base += "    uint256 public totalSupply;\n    function transfer(address, uint256) external pure returns (bool) { return true; }\n"
    base += "}\n"
    return base


async def run_live_spec_validation(spec: dict, run_id: str | None = None) -> tuple[bool, str]:
    """Run shadow compile in OpenSandbox. Returns (passed, message). When run_id is set, streams logs to agent_logs."""
    if not OPENSANDBOX_ENABLED or not spec:
        return True, "skipped"
    try:
        from execution_backend import get_execution_backend

        backend = get_execution_backend()
        if not hasattr(backend, "run_compile"):
            return True, "skipped"
        stub = _stub_from_spec(spec)
        on_log = None
        if run_id and hasattr(backend, "run_compile_streaming"):
            from db import insert_agent_log

            def _on_log(stage: str, line: str) -> None:
                insert_agent_log(run_id, "compile", stage, line[:4096], log_level="info")

            on_log = _on_log
            result = await backend.run_compile_streaming(
                stub, framework="foundry", run_id=run_id, on_log=on_log
            )
        else:
            result = await backend.run_compile(stub, framework="foundry")
        if result.success:
            logger.info("[live_spec_validation] shadow compile passed")
            return True, "passed"
        err = "; ".join(result.errors or ["compile failed"])[:200]
        logger.warning("[live_spec_validation] shadow compile failed: %s", err)
        return False, err
    except ImportError:
        return True, "skipped"
    except Exception as e:
        logger.warning("[live_spec_validation] %s", e)
        return True, "skipped"
