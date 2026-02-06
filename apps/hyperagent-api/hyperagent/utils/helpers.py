"""Utility helper functions"""

import hashlib
import re
from typing import Any, Dict, Optional, Tuple

from web3 import Web3


def calculate_hash(content: str) -> str:
    """Calculate SHA256 hash of content"""
    return hashlib.sha256(content.encode()).hexdigest()


def validate_ethereum_address(address: str) -> bool:
    """Validate Ethereum address format"""
    pattern = r"^0x[a-fA-F0-9]{40}$"
    return bool(re.match(pattern, address))


def format_gas_cost(gas_used: int, gas_price: int) -> Dict[str, Any]:
    """Format gas cost in multiple units"""
    cost_wei = gas_used * gas_price
    cost_ether = cost_wei / 1e18

    return {"wei": cost_wei, "ether": cost_ether, "gwei": cost_wei / 1e9}


def validate_wallet_address(
    address: str, network: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Validate wallet address format and checksum

    Args:
        address: Wallet address to validate
        network: Optional network name for network-specific validation

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if address is valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    if not address:
        return False, "Wallet address is required"

    if not isinstance(address, str):
        return False, f"Wallet address must be a string, got {type(address)}"

    # Remove whitespace
    address = address.strip()

    if not address:
        return False, "Wallet address cannot be empty"

    # Check length (0x + 40 hex chars = 42)
    if len(address) != 42:
        return (
            False,
            f"Invalid wallet address length: expected 42 characters (0x + 40 hex), got {len(address)}",
        )

    # Check 0x prefix
    if not address.startswith("0x"):
        return False, "Wallet address must start with '0x'"

    # Check hex characters
    try:
        int(address, 16)
    except ValueError:
        return False, "Wallet address contains invalid hexadecimal characters"

    # Check zero address
    if address.lower() == "0x0000000000000000000000000000000000000000":
        return False, "Zero address (0x0000...0000) is not a valid wallet address"

    # Validate checksum format (EIP-55)
    try:
        # Use Web3 to validate checksum
        w3 = Web3()
        if not w3.is_address(address):
            return False, f"Invalid wallet address format: {address}"

        # Convert to checksum address (validates checksum)
        checksum_address = w3.to_checksum_address(address)

        # If address was provided in lowercase/uppercase, accept it but return checksum version
        if address != checksum_address:
            # Address is valid but not in checksum format
            # Return True but with a note that checksum should be used
            return True, None  # Valid, but caller should use checksum_address
    except Exception as e:
        return False, f"Wallet address validation error: {str(e)}"

    return True, None


def normalize_wallet_address(address: str) -> str:
    """
    Normalize wallet address to checksum format (EIP-55)

    Args:
        address: Wallet address to normalize

    Returns:
        Checksum-formatted address

    Raises:
        ValueError: If address is invalid
    """
    is_valid, error = validate_wallet_address(address)
    if not is_valid:
        raise ValueError(error or "Invalid wallet address")

    w3 = Web3()
    return w3.to_checksum_address(address)
