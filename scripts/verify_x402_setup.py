#!/usr/bin/env python3
"""
x402 Setup Validation Script

Validates x402 payment configuration and service health.
Checks:
- x402 service is running
- Thirdweb configuration
- Network RPC endpoints
- Facilitator wallet balance
- Acontext API connection (if enabled)
"""
import sys
import os
import asyncio
import httpx
from typing import Dict, List, Tuple

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hyperagent.core.config import settings


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_success(message: str):
    """Print success message"""
    print(f"{Colors.GREEN}✓{Colors.RESET} {message}")


def print_error(message: str):
    """Print error message"""
    print(f"{Colors.RED}✗{Colors.RESET} {message}")


def print_warning(message: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {message}")


def print_info(message: str):
    """Print info message"""
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {message}")


def print_header(message: str):
    """Print header message"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{message}{Colors.RESET}")
    print("=" * len(message))


async def check_x402_service() -> Tuple[bool, str]:
    """Check if x402 verification service is running"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.x402_service_url}/health")
            if response.status_code == 200:
                return True, "x402 service is running"
            else:
                return False, f"x402 service returned status {response.status_code}"
    except httpx.RequestError as e:
        return False, f"x402 service not reachable: {str(e)}"


async def check_thirdweb_config() -> Tuple[bool, str]:
    """Check Thirdweb configuration"""
    issues = []
    
    if not settings.thirdweb_secret_key:
        issues.append("THIRDWEB_SECRET_KEY not set")
    
    if not settings.thirdweb_server_wallet_address:
        issues.append("THIRDWEB_SERVER_WALLET_ADDRESS not set")
    elif not settings.thirdweb_server_wallet_address.startswith("0x"):
        issues.append("THIRDWEB_SERVER_WALLET_ADDRESS invalid format")
    
    if not settings.merchant_wallet_address:
        issues.append("MERCHANT_WALLET_ADDRESS not set")
    elif not settings.merchant_wallet_address.startswith("0x"):
        issues.append("MERCHANT_WALLET_ADDRESS invalid format")
    
    if issues:
        return False, "; ".join(issues)
    
    return True, "Thirdweb configuration valid"


async def check_network_rpc(network: str, rpc_url: str) -> Tuple[bool, str]:
    """Check network RPC endpoint"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_blockNumber",
                "params": [],
                "id": 1
            }
            response = await client.post(rpc_url, json=payload)
            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    return True, f"{network} RPC is accessible"
                else:
                    return False, f"{network} RPC returned invalid response"
            else:
                return False, f"{network} RPC returned status {response.status_code}"
    except httpx.RequestError as e:
        return False, f"{network} RPC not reachable: {str(e)}"


async def check_facilitator_balance() -> Tuple[bool, str]:
    """Check facilitator wallet balance (if RPC available)"""
    if not settings.thirdweb_server_wallet_address:
        return False, "Facilitator wallet address not configured"
    
    # Check Avalanche Fuji balance
    try:
        rpc_url = settings.avalanche_fuji_rpc
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "jsonrpc": "2.0",
                "method": "eth_getBalance",
                "params": [settings.thirdweb_server_wallet_address, "latest"],
                "id": 1
            }
            response = await client.post(rpc_url, json=payload)
            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    balance_wei = int(data["result"], 16)
                    balance_avax = balance_wei / 1e18
                    if balance_avax < 0.001:
                        return False, f"Facilitator wallet has low balance: {balance_avax:.6f} AVAX (minimum 0.001 recommended)"
                    else:
                        return True, f"Facilitator wallet balance: {balance_avax:.6f} AVAX"
                else:
                    return False, "Could not retrieve balance"
            else:
                return False, f"RPC returned status {response.status_code}"
    except Exception as e:
        return False, f"Could not check balance: {str(e)}"


async def check_acontext_api() -> Tuple[bool, str]:
    """Check Acontext API connection (if enabled)"""
    if not settings.enable_acontext:
        return None, "Acontext is disabled"
    
    if not settings.acontext_url or not settings.acontext_api_key:
        return False, "Acontext enabled but URL or API key not configured"
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            headers = {"Authorization": f"Bearer {settings.acontext_api_key}"}
            response = await client.get(f"{settings.acontext_url}/health", headers=headers)
            if response.status_code == 200:
                return True, "Acontext API is accessible"
            else:
                return False, f"Acontext API returned status {response.status_code}"
    except httpx.RequestError as e:
        return False, f"Acontext API not reachable: {str(e)}"


async def check_usdc_addresses() -> Tuple[bool, str]:
    """Check USDC addresses are configured"""
    issues = []
    
    if not settings.usdc_address_fuji:
        issues.append("USDC_ADDRESS_FUJI not set")
    elif not settings.usdc_address_fuji.startswith("0x"):
        issues.append("USDC_ADDRESS_FUJI invalid format")
    
    if not settings.usdc_address_avalanche:
        issues.append("USDC_ADDRESS_AVALANCHE not set")
    elif not settings.usdc_address_avalanche.startswith("0x"):
        issues.append("USDC_ADDRESS_AVALANCHE invalid format")
    
    if issues:
        return False, "; ".join(issues)
    
    return True, "USDC addresses configured"


async def main():
    """Run all validation checks"""
    print_header("HyperAgent x402 Setup Validation")
    
    results: List[Tuple[str, bool, str]] = []
    
    # Check x402 service
    print_info("Checking x402 verification service...")
    success, message = await check_x402_service()
    results.append(("x402 Service", success, message))
    if success:
        print_success(message)
    else:
        print_error(message)
    
    # Check Thirdweb config
    print_info("Checking Thirdweb configuration...")
    success, message = await check_thirdweb_config()
    results.append(("Thirdweb Config", success, message))
    if success:
        print_success(message)
    else:
        print_error(message)
    
    # Check USDC addresses
    print_info("Checking USDC addresses...")
    success, message = await check_usdc_addresses()
    results.append(("USDC Addresses", success, message))
    if success:
        print_success(message)
    else:
        print_error(message)
    
    # Check network RPCs
    print_info("Checking network RPC endpoints...")
    for network, rpc_url in [
        ("Avalanche Fuji", settings.avalanche_fuji_rpc),
        ("Avalanche Mainnet", settings.avalanche_mainnet_rpc),
    ]:
        success, message = await check_network_rpc(network, rpc_url)
        results.append((f"{network} RPC", success, message))
        if success:
            print_success(message)
        else:
            print_error(message)
    
    # Check facilitator balance
    print_info("Checking facilitator wallet balance...")
    success, message = await check_facilitator_balance()
    results.append(("Facilitator Balance", success, message))
    if success:
        print_success(message)
    else:
        print_warning(message)  # Warning, not error (might be testnet)
    
    # Check Acontext API
    print_info("Checking Acontext API...")
    success, message = await check_acontext_api()
    if success is not None:
        results.append(("Acontext API", success, message))
        if success:
            print_success(message)
        else:
            print_warning(message)
    else:
        print_info(message)
    
    # Summary
    print_header("Validation Summary")
    total = len(results)
    passed = sum(1 for _, success, _ in results if success)
    failed = total - passed
    
    print(f"\nTotal checks: {total}")
    print(f"{Colors.GREEN}Passed: {passed}{Colors.RESET}")
    if failed > 0:
        print(f"{Colors.RED}Failed: {failed}{Colors.RESET}")
    
    print("\nDetailed Results:")
    for name, success, message in results:
        status = f"{Colors.GREEN}✓{Colors.RESET}" if success else f"{Colors.RED}✗{Colors.RESET}"
        print(f"  {status} {name}: {message}")
    
    if failed > 0:
        print(f"\n{Colors.YELLOW}Warning: Some checks failed. Please review the errors above.{Colors.RESET}")
        sys.exit(1)
    else:
        print(f"\n{Colors.GREEN}All checks passed! x402 setup is valid.{Colors.RESET}")
        sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())

