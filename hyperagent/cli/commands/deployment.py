"""Deployment management commands"""

import asyncio
import json
from typing import Optional

import click
import httpx
from rich.progress import BarColumn, Progress

from hyperagent.cli.formatters import (
    CLIStyle,
    format_deployment_confirmation,
    format_error,
    handle_api_error,
)
from hyperagent.cli.shared import (
    console,
    create_progress_columns,
    get_api_url,
)
from hyperagent.core.config import settings


def register_deployment_commands(deployment_group: click.Group) -> None:
    """Register all deployment commands with the deployment group"""

    @deployment_group.command()
    @click.option("--contract-id", "-c", required=True, help="Contract ID to deploy")
    @click.option(
        "--network",
        "-n",
        type=str,
        required=True,
        help="Target network (use 'hyperagent network list' to see available networks)",
    )
    @click.option("--private-key", "-k", help="Private key for deployment (or use config)")
    @click.option(
        "--constructor-args",
        help="Constructor arguments as JSON array (e.g., '[1000000, \"0x123...\"]')",
    )
    @click.option("--confirm", is_flag=True, help="Skip confirmation prompt")
    def deploy(
        contract_id: str,
        network: str,
        private_key: Optional[str],
        constructor_args: Optional[str],
        confirm: bool,
    ) -> None:
        """[>] Deploy contract to blockchain"""
        if not confirm:
            if not click.confirm(f"Deploy contract {contract_id} to {network}?"):
                return

        # Validate network exists
        from hyperagent.blockchain.network_features import NetworkFeatureManager

        try:
            NetworkFeatureManager.get_network_config(network)
        except Exception:
            format_error(
                "Invalid network",
                f"Network '{network}' not found",
                suggestions=[
                    "Run: hyperagent network list",
                    "Check config/networks.yaml",
                ],
            )
            return

        console.print(f"{CLIStyle.INFO} Deploying contract to {network}...")

        try:
            api_url = get_api_url()

            # Fetch contract data from API
            async def get_contract_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/contracts/{contract_id}")
                    response.raise_for_status()
                    return response.json()

            contract_data = asyncio.run(get_contract_async())

            # Get compiled contract (bytecode and ABI)
            compiled_contract = {
                "bytecode": contract_data.get("bytecode", ""),
                "abi": contract_data.get("abi", []),
            }

            if not compiled_contract.get("bytecode"):
                format_error(
                    "Contract bytecode not found",
                    suggestions=["Contract may not be compiled", "Verify contract ID is correct"],
                )
                return

            # Parse constructor args if provided
            constructor_args_list = []
            if constructor_args:
                try:
                    constructor_args_list = json.loads(constructor_args)
                except json.JSONDecodeError:
                    format_error(
                        "Invalid constructor arguments format",
                        suggestions=[
                            "Use JSON array format: '[value1, value2]'",
                            "Example: '[1000000, \"0x123...\"]'",
                        ],
                    )
                    return

            # Use private key from config if not provided
            deploy_private_key = private_key or settings.private_key
            if not deploy_private_key:
                format_error(
                    "Private key required",
                    suggestions=[
                        "Provide --private-key option",
                        "Or set PRIVATE_KEY in environment/config",
                    ],
                )
                return

            # Deploy contract
            async def deploy_async():
                async with httpx.AsyncClient(timeout=300.0) as client:
                    response = await client.post(
                        f"{api_url}/api/v1/deployments/deploy",
                        json={
                            "compiled_contract": compiled_contract,
                            "network": network,
                            "private_key": deploy_private_key,
                            "constructor_args": constructor_args_list,
                        },
                    )
                    response.raise_for_status()
                    return response.json()

            with Progress(*create_progress_columns(), BarColumn(), console=console) as progress:
                task = progress.add_task(f"{CLIStyle.WAIT} Deploying contract...", total=None)
                deployment_result = asyncio.run(deploy_async())
                progress.update(task, completed=True)

            # Display deployment result
            format_deployment_confirmation(deployment_result)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"contract deployment")
        except Exception as e:
            format_error("Failed to deploy contract", str(e))

    @deployment_group.command()
    @click.option("--deployment-id", "-d", required=True, help="Deployment ID")
    def status(deployment_id: str) -> None:
        """[*] Check deployment status"""
        try:
            api_url = get_api_url()

            async def get_deployment_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/deployments/{deployment_id}")
                    response.raise_for_status()
                    return response.json()

            deployment_data = asyncio.run(get_deployment_async())
            format_deployment_confirmation(deployment_data)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"deployment {deployment_id}")
        except Exception as e:
            format_error("Failed to get deployment", str(e))

    @deployment_group.command()
    @click.option("--deployment-id", "-d", required=True, help="Deployment ID")
    def verify(deployment_id: str) -> None:
        """[*] Verify deployment status"""
        try:
            api_url = get_api_url()

            async def get_deployment_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/deployments/{deployment_id}")
                    response.raise_for_status()
                    return response.json()

            deployment_data = asyncio.run(get_deployment_async())
            format_deployment_confirmation(deployment_data)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"deployment {deployment_id}")
        except Exception as e:
            format_error("Failed to get deployment", str(e))

    @deployment_group.command()
    @click.option(
        "--contracts-file",
        "-f",
        type=click.File("r"),
        required=True,
        help="JSON file with contracts to deploy",
    )
    @click.option(
        "--network",
        "-n",
        type=str,
        required=True,
        help="Target network (use 'hyperagent network list' to see available networks)",
    )
    @click.option(
        "--parallel/--no-parallel",
        default=True,
        help="Deploy contracts in parallel (best-effort)",
    )
    @click.option("--max-parallel", type=int, default=10, help="Maximum parallel deployments")
    @click.option("--private-key", "-k", help="Private key for deployment (or use config)")
    def batch(
        contracts_file: click.File,
        network: str,
        parallel: bool,
        max_parallel: int,
        private_key: Optional[str],
    ) -> None:
        """[>] Deploy multiple contracts (best-effort parallelism)"""
        try:
            contracts_data = json.load(contracts_file)
            contracts = contracts_data.get("contracts", [])

            if not contracts:
                format_error("No contracts found in file", "File must contain 'contracts' array")
                return

            # Validate network exists
            from hyperagent.blockchain.network_features import NetworkFeatureManager

            try:
                NetworkFeatureManager.get_network_config(network)
            except Exception:
                format_error(
                    "Invalid network",
                    f"Network '{network}' not found",
                    suggestions=[
                        "Run: hyperagent network list",
                        "Check config/networks.yaml",
                    ],
                )
                return

            console.print(f"{CLIStyle.INFO} Deploying {len(contracts)} contracts to {network}...")
            if parallel:
                console.print(
                    f"{CLIStyle.INFO} Parallel deployment enabled (max: {max_parallel})"
                )
            else:
                console.print(f"{CLIStyle.INFO} Parallel deployment disabled")

            api_url = get_api_url()

            async def deploy_batch_async():
                async with httpx.AsyncClient(timeout=300.0) as client:
                    response = await client.post(
                        f"{api_url}/api/v1/deployments/batch",
                        json={
                            "contracts": contracts,
                            "parallel": parallel,
                            "max_parallel": max_parallel,
                            "private_key": private_key,
                        },
                    )
                    response.raise_for_status()
                    return response.json()

            with Progress(*create_progress_columns(), BarColumn(), console=console) as progress:
                task = progress.add_task(f"{CLIStyle.WAIT} Deploying batch...", total=None)
                result = asyncio.run(deploy_batch_async())
                progress.update(task, completed=True)

            # Display results
            console.print(f"\n{CLIStyle.SUCCESS} Batch deployment completed")
            console.print(f"{CLIStyle.INFO} Total time: {result.get('total_time', 0):.2f}s")
            console.print(f"{CLIStyle.INFO} Success: {result.get('success_count', 0)}")
            console.print(f"{CLIStyle.INFO} Failed: {result.get('failed_count', 0)}")
            console.print(f"{CLIStyle.INFO} Parallel count: {result.get('parallel_count', 0)}")

            # Display individual results
            for deployment in result.get("deployments", []):
                if deployment["status"] == "success":
                    console.print(
                        f"{CLIStyle.SUCCESS} {deployment['contract_name']}: {deployment.get('contract_address', 'N/A')}"
                    )
                else:
                    console.print(
                        f"{CLIStyle.ERROR} {deployment['contract_name']}: {deployment.get('error', 'Unknown error')}"
                    )

        except json.JSONDecodeError as e:
            format_error(
                "Invalid JSON file",
                str(e),
                suggestions=[
                    "Check JSON syntax",
                    "Ensure file contains 'contracts' array",
                    "Validate JSON with: python -m json.tool <file>",
                ],
            )
        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, "batch deployment")
        except Exception as e:
            format_error("Failed to deploy batch", str(e))

    @deployment_group.command()
    @click.option("--deployment-id", "-d", help="Deployment ID")
    @click.option("--contract-address", "-a", help="Contract address (if not using deployment-id)")
    @click.option("--function", "-f", required=True, help="Function name to call")
    @click.option("--args", help="Function arguments as JSON array")
    @click.option(
        "--network",
        "-n",
        type=str,
        help="Network (if not using deployment-id; use 'hyperagent network list')",
    )
    @click.option("--value", "-v", help="ETH value to send (for payable functions)")
    def interact(
        deployment_id: Optional[str],
        contract_address: Optional[str],
        function: str,
        args: Optional[str],
        network: Optional[str],
        value: Optional[str],
    ) -> None:
        """[*] Interact with deployed contract"""
        if not deployment_id and not contract_address:
            format_error(
                "Either --deployment-id or --contract-address must be provided",
                suggestions=[
                    "Provide --deployment-id of existing deployment",
                    "Or provide --contract-address and --network",
                ],
            )
            return

        console.print(f"{CLIStyle.INFO} Calling {function} on contract...")

        try:
            api_url = get_api_url()
            contract_addr = contract_address
            deploy_network = network

            if deployment_id:
                # Fetch deployment data
                async def get_deployment_async():
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(f"{api_url}/api/v1/deployments/{deployment_id}")
                        response.raise_for_status()
                        return response.json()

                deployment_data = asyncio.run(get_deployment_async())
                contract_addr = deployment_data.get("contract_address")
                deploy_network = deployment_data.get("network")

                if not contract_addr:
                    format_error(
                        "Contract address not found",
                        suggestions=["Verify deployment ID is correct"],
                    )
                    return

            if not contract_addr or not deploy_network:
                format_error(
                    "Contract address and network required",
                    suggestions=[
                        "Provide both --contract-address and --network",
                        "Or use --deployment-id",
                    ],
                )
                return

            # Parse function arguments
            function_args = []
            if args:
                try:
                    function_args = json.loads(args)
                except json.JSONDecodeError:
                    format_error(
                        "Invalid function arguments format",
                        suggestions=[
                            "Use JSON array format: '[value1, value2]'",
                            "Example: '[\"0x123...\", 1000]'",
                        ],
                    )
                    return

            console.print(f"{CLIStyle.INFO} Contract: {contract_addr}")
            console.print(f"{CLIStyle.INFO} Network: {deploy_network}")
            console.print(f"{CLIStyle.INFO} Function: {function}")
            if function_args:
                console.print(f"{CLIStyle.INFO} Arguments: {function_args}")
            if value:
                console.print(f"{CLIStyle.INFO} Value: {value} ETH")

            # Call contract interaction API
            async def call_contract_async():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    payload = {
                        "contract_address": contract_addr,
                        "network": deploy_network,
                        "function_name": function,
                        "function_args": function_args,
                    }
                    if value:
                        from web3 import Web3
                        payload["value"] = str(Web3.to_wei(float(value), "ether"))
                    
                    response = await client.post(
                        f"{api_url}/api/v1/contracts/call",
                        json=payload
                    )
                    response.raise_for_status()
                    return response.json()
            
            result = asyncio.run(call_contract_async())
            
            if result.get("success"):
                console.print(f"{CLIStyle.SUCCESS} Transaction prepared successfully")
                console.print(f"{CLIStyle.INFO} Transaction data: {result.get('result', {}).get('transaction', {})}")
                console.print(f"{CLIStyle.INFO} Sign this transaction in your wallet and submit it to the blockchain")
            else:
                format_error(
                    "Failed to prepare contract call",
                    result.get("error", "Unknown error"),
                    suggestions=["Check function name and arguments", "Verify contract address and network"]
                )

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"deployment {deployment_id or 'interaction'}")
        except Exception as e:
            format_error("Failed to interact with contract", str(e))
