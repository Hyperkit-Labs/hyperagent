"""
ERC-8004 on-chain registration. Calls register(agentURI) on IdentityRegistry.
Requires ERC8004_REGISTER_PRIVATE_KEY and chain support in erc8004.yaml.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from registries import _get_erc8004_chain, get_chain_rpc_explorer

logger = logging.getLogger(__name__)

IDENTITY_REGISTRY_ABI = [
    {
        "inputs": [{"name": "agentURI", "type": "string"}],
        "name": "register",
        "outputs": [{"name": "agentId", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def is_configured() -> bool:
    return bool((os.environ.get("ERC8004_REGISTER_PRIVATE_KEY") or "").strip())


def register_on_chain(chain_id: int, agent_uri: str | None = None) -> dict[str, Any]:
    """
    Call register(agentURI) on ERC-8004 IdentityRegistry for chain_id.
    Returns { success, agentId, txHash, error? }.
    """
    pk = (os.environ.get("ERC8004_REGISTER_PRIVATE_KEY") or "").strip()
    if not pk:
        return {"success": False, "error": "ERC8004_REGISTER_PRIVATE_KEY not set"}
    chain_entry = _get_erc8004_chain(chain_id)
    if not chain_entry:
        return {"success": False, "error": f"Chain {chain_id} not in erc8004 registry"}
    registry_addr = (chain_entry.get("identityRegistry") or "").strip()
    if not registry_addr:
        return {"success": False, "error": "No identityRegistry for chain"}
    rpc_explorer = get_chain_rpc_explorer(chain_id)
    if not rpc_explorer:
        return {"success": False, "error": f"No RPC URL for chain {chain_id}"}
    rpc_url = rpc_explorer[0]
    if not rpc_url:
        return {"success": False, "error": "RPC URL empty"}
    uri = (agent_uri or os.environ.get("ERC8004_AGENT_URI") or "https://hyperkitlabs.com/agent.json").strip()
    try:
        from web3 import Web3
        from eth_account import Account
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            return {"success": False, "error": "RPC connection failed"}
        acct = Account.from_key(pk)
        contract = w3.eth.contract(address=Web3.to_checksum_address(registry_addr), abi=IDENTITY_REGISTRY_ABI)
        tx = contract.functions.register(uri).build_transaction({
            "from": acct.address,
            "gas": 300_000,
            "chainId": chain_id,
        })
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.get("status") != 1:
            return {"success": False, "error": "Transaction reverted", "txHash": tx_hash.hex()}
        agent_id = None
        transfer_topic = Web3.keccak(text="Transfer(address,address,uint256)")
        for log in receipt.get("logs") or []:
            topics = log.get("topics") or []
            if len(topics) >= 4 and topics[0] == transfer_topic:
                t3 = topics[3]
                agent_id = int(t3.hex(), 16) if hasattr(t3, "hex") else int(t3, 16)
                break
        if agent_id is None:
            agent_id = 0
        logger.info("[erc8004] registered chain=%s agentId=%s tx=%s", chain_id, agent_id, tx_hash.hex())
        return {
            "success": True,
            "agentId": str(agent_id),
            "txHash": tx_hash.hex(),
            "chainId": chain_id,
            "contractAddress": registry_addr,
        }
    except Exception as e:
        logger.warning("[erc8004] register failed: %s", e)
        return {"success": False, "error": str(e)[:300]}
