"""Contract management commands"""

import asyncio
from typing import Optional

import click
import httpx

from hyperagent.cli.formatters import (
    CLIStyle,
    format_audit_report,
    format_contract_code,
    format_error,
    format_success,
    format_test_results,
    handle_api_error,
)
from hyperagent.cli.shared import console, get_api_url


def register_contract_commands(contract_group: click.Group) -> None:
    """Register all contract commands with the contract group"""

    @contract_group.command()
    @click.option("--contract-id", "-c", required=True, help="Contract ID")
    @click.option(
        "--format",
        "-f",
        type=click.Choice(["code", "abi", "both"]),
        default="code",
        help="Output format",
    )
    def view(contract_id: str, format: str) -> None:
        """[*] View contract code or ABI"""
        try:
            api_url = get_api_url()

            async def get_contract_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/contracts/{contract_id}")
                    response.raise_for_status()
                    return response.json()

            contract_data = asyncio.run(get_contract_async())

            if format in ["code", "both"]:
                source_code = contract_data.get("source_code")
                if source_code:
                    format_contract_code(source_code)
                else:
                    console.print(f"{CLIStyle.WARNING} Contract code not available")

            if format in ["abi", "both"]:
                abi = contract_data.get("abi")
                if abi:
                    import json

                    console.print("\n[bold blue]ABI:[/bold blue]")
                    console.print(json.dumps(abi, indent=2))
                else:
                    console.print(f"{CLIStyle.WARNING} ABI not available")

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"contract {contract_id}")
        except Exception as e:
            format_error("Failed to get contract", str(e))

    @contract_group.command()
    @click.option("--file", "-f", type=click.File("r"), help="Solidity file to audit")
    @click.option("--contract-id", "-c", help="Contract ID to audit")
    @click.option(
        "--level",
        "-l",
        type=click.Choice(["basic", "standard", "comprehensive"]),
        default="standard",
        help="Audit depth",
    )
    def audit(file: Optional[click.File], contract_id: Optional[str], level: str) -> None:
        """[SEC] Run security audit on contract"""
        if not file and not contract_id:
            format_error(
                "Either --file or --contract-id must be provided",
                suggestions=[
                    "Provide --file with path to Solidity file",
                    "Or provide --contract-id of existing contract",
                ],
            )
            return

        console.print(f"{CLIStyle.INFO} Running {level} security audit...")

        try:
            api_url = get_api_url()
            contract_code = None

            if file:
                contract_code = file.read()
            elif contract_id:
                # Fetch contract source code from API
                async def get_contract_async():
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(f"{api_url}/api/v1/contracts/{contract_id}")
                        response.raise_for_status()
                        return response.json()

                contract_data = asyncio.run(get_contract_async())
                contract_code = contract_data.get("source_code")

                if not contract_code:
                    format_error(
                        "Contract source code not found",
                        suggestions=[
                            "Verify contract ID is correct",
                            "Contract may not have source code stored",
                        ],
                    )
                    return

            # Call audit API
            async def audit_async():
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{api_url}/api/v1/contracts/audit",
                        json={"contract_code": contract_code, "audit_level": level},
                    )
                    response.raise_for_status()
                    return response.json()

            audit_result = asyncio.run(audit_async())
            format_audit_report(audit_result)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"contract audit")
        except Exception as e:
            format_error("Failed to run audit", str(e))

    @contract_group.command()
    @click.option("--contract-id", "-c", required=True, help="Contract ID to test")
    @click.option(
        "--framework",
        "-f",
        type=click.Choice(["foundry", "hardhat"]),
        default="foundry",
        help="Test framework",
    )
    def test(contract_id: str, framework: str) -> None:
        """[TEST] Run tests on contract"""
        console.print(f"{CLIStyle.INFO} Running tests with {framework}...")
        console.print(f"{CLIStyle.WAIT} Test API endpoint not yet implemented")
        # TODO: Implement when test endpoint is available

    @contract_group.command()
    @click.option("--contract-id", "-c", required=True)
    @click.option("--output", "-o", type=click.Path(), required=True, help="Output file")
    def export(contract_id: str, output: str):
        """[>] Export contract code"""
        try:
            api_url = get_api_url()

            async def get_contract_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/contracts/{contract_id}")
                    response.raise_for_status()
                    return response.json()

            contract_data = asyncio.run(get_contract_async())
            source_code = contract_data.get("source_code")

            if source_code:
                with open(output, "w") as f:
                    f.write(source_code)
                format_success(f"Contract exported to {output}")
            else:
                format_error("Contract source code not available")

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"contract {contract_id}")
        except Exception as e:
            format_error("Failed to export contract", str(e))

    @contract_group.command()
    @click.option("--contract-id", "-c", help="Contract ID")
    @click.option("--address", "-a", help="Contract address")
    @click.option("--network", "-n", help="Network (if using address)")
    @click.option(
        "--explorer",
        "-e",
        type=click.Choice(["blockscout", "etherscan", "hyperion", "mantle"]),
        default="blockscout",
        help="Explorer to use",
    )
    def verify(
        contract_id: Optional[str],
        address: Optional[str],
        network: Optional[str],
        explorer: str,
    ) -> None:
        """[*] Get contract verification info"""
        if not contract_id and not address:
            format_error(
                "Either --contract-id or --address must be provided",
                suggestions=[
                    "Provide --contract-id of existing contract",
                    "Or provide --address and --network",
                ],
            )
            return

        try:
            api_url = get_api_url()

            if contract_id:
                # Fetch contract and deployment data
                async def get_contract_data_async():
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        # Get contract
                        contract_response = await client.get(
                            f"{api_url}/api/v1/contracts/{contract_id}"
                        )
                        contract_response.raise_for_status()
                        contract_data = contract_response.json()

                        # Get deployments for this contract
                        deployments_response = await client.get(
                            f"{api_url}/api/v1/contracts/{contract_id}/deployments"
                        )
                        deployments = []
                        if deployments_response.status_code == 200:
                            deployments = deployments_response.json()

                        return contract_data, deployments

                contract_data, deployments = asyncio.run(get_contract_data_async())

                if not deployments:
                    format_error(
                        "No deployments found for contract",
                        suggestions=[
                            "Contract may not be deployed yet",
                            "Deploy contract first: hyperagent deployment deploy",
                        ],
                    )
                    return

                # Display verification info
                console.print(f"\n{CLIStyle.INFO} Contract Verification Info:")
                console.print(f"  Contract: {contract_data.get('contract_name', 'N/A')}")
                console.print(f"  Source Code Hash: {contract_data.get('source_code_hash', 'N/A')}")

                for deployment in deployments:
                    contract_address = deployment.get("contract_address")
                    tx_hash = deployment.get("transaction_hash")
                    deploy_network = deployment.get("network", "unknown")

                    console.print(f"\n  Deployment on {deploy_network}:")
                    console.print(f"    Address: {contract_address}")
                    console.print(f"    Transaction: {tx_hash}")

                    # Generate explorer URL
                    explorer_urls = {
                        "blockscout": f"https://blockscout.com/{deploy_network}/address/{contract_address}",
                        "etherscan": f"https://etherscan.io/address/{contract_address}",
                        "hyperion": f"https://hyperion-testnet-explorer.metisdevops.link/address/{contract_address}",
                        "mantle": f"https://explorer.mantle.xyz/address/{contract_address}",
                    }

                    if explorer in explorer_urls:
                        console.print(f"    Explorer: {explorer_urls[explorer]}")
                    else:
                        console.print(
                            f"    {CLIStyle.WARNING} Explorer URL not configured for {explorer}"
                        )
            else:
                # Direct address verification
                if not network:
                    format_error(
                        "Network required when using --address",
                        suggestions=["Provide --network option"],
                    )
                    return

                console.print(f"\n{CLIStyle.INFO} Contract Verification Info:")
                console.print(f"  Address: {address}")
                console.print(f"  Network: {network}")

                # Generate explorer URL
                explorer_urls = {
                    "blockscout": f"https://blockscout.com/{network}/address/{address}",
                    "etherscan": f"https://etherscan.io/address/{address}",
                    "hyperion": f"https://hyperion-testnet-explorer.metisdevops.link/address/{address}",
                    "mantle": f"https://explorer.mantle.xyz/address/{address}",
                }

                if explorer in explorer_urls:
                    console.print(f"  Explorer: {explorer_urls[explorer]}")
                else:
                    console.print(
                        f"  {CLIStyle.WARNING} Explorer URL not configured for {explorer}"
                    )

            console.print(
                f"\n{CLIStyle.INFO} Note: Automatic verification submission not yet implemented"
            )
            console.print(
                f"{CLIStyle.INFO} Use explorer website to submit source code for verification"
            )

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"contract verification")
        except Exception as e:
            format_error("Failed to get verification info", str(e))
