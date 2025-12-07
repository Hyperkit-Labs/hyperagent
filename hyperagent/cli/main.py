"""HyperAgent CLI - ASCII-based command interface"""

import asyncio
import platform
import sys
import time
from typing import Any, List, Optional

import click
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn

from hyperagent.cli.formatters import (
    CLIStyle,
    format_audit_report,
    format_contract_code,
    format_deployment_confirmation,
    format_error,
    format_progress_bar_windows_safe,
    format_success,
    format_test_results,
    format_unicode_progress_bar,
    format_workflow_list,
    format_workflow_status,
    get_stage_name,
    handle_api_error,
    print_banner,
)
from hyperagent.core.config import settings

console = Console()


def get_api_url() -> str:
    """Get API URL, converting 0.0.0.0 to localhost for external access"""
    api_host = "localhost" if settings.api_host == "0.0.0.0" else settings.api_host
    return f"http://{api_host}:{settings.api_port}"


def create_progress_columns() -> List[Any]:
    """Create progress columns, avoiding Unicode spinner on Windows"""
    if platform.system() == "Windows":
        return [TextColumn("[progress.description]{task.description}")]
    else:
        return [SpinnerColumn(), TextColumn("[progress.description]{task.description}")]


def monitor_workflow_progress(
    workflow_id: str, api_url: str, poll_interval: int = 2, output_format: str = "table"
) -> None:
    """Monitor workflow progress with real-time Unicode progress bar"""
    last_progress = -1
    last_stage = ""
    start_time = time.time()

    console.print(f"\n{CLIStyle.INFO} Monitoring workflow progress...")
    console.print(f"{CLIStyle.INFO} Press Ctrl+C to stop monitoring\n")

    try:
        while True:
            # Poll API
            async def get_status_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/workflows/{workflow_id}")
                    response.raise_for_status()
                    return response.json()

            status_data = asyncio.run(get_status_async())
            status = status_data.get("status", "unknown")
            progress = status_data.get("progress_percentage", 0)
            stage = get_stage_name(status)

            # Update progress bar if changed (Windows-safe)
            if progress != last_progress or stage != last_stage:
                # Use Windows-safe version directly on Windows to avoid encoding issues
                if platform.system() == "Windows":
                    progress_bar = format_progress_bar_windows_safe(
                        progress, stage=stage, label="Workflow"
                    )
                    progress_prefix = "[...]"
                else:
                    try:
                        progress_bar = format_unicode_progress_bar(
                            progress, stage=stage, label="Workflow"
                        )
                        progress_prefix = CLIStyle.WAIT
                    except UnicodeEncodeError:
                        # Fallback to ASCII on other platforms if encoding fails
                        progress_bar = format_progress_bar_windows_safe(
                            progress, stage=stage, label="Workflow"
                        )
                        progress_prefix = "[...]"

                # Use sys.stdout.write for better Windows compatibility
                try:
                    sys.stdout.write(f"\r{progress_prefix} {progress_bar}")
                    sys.stdout.flush()
                except UnicodeEncodeError:
                    # Final fallback: ASCII only
                    progress_bar_ascii = format_progress_bar_windows_safe(
                        progress, stage=stage, label="Workflow"
                    )
                    sys.stdout.write(f"\r[...] {progress_bar_ascii}")
                    sys.stdout.flush()

                last_progress = progress
                last_stage = stage

            # Check completion
            if status in ["completed", "failed"]:
                sys.stdout.write("\n")
                if status == "completed":
                    elapsed = time.time() - start_time
                    console.print(f"\n{CLIStyle.SUCCESS} Workflow completed in {elapsed:.1f}s")

                    # Show final status in requested format
                    if output_format == "json":
                        import json

                        console.print(json.dumps(status_data, indent=2, default=str))
                    elif output_format == "yaml":
                        try:
                            import yaml

                            console.print(
                                yaml.dump(status_data, default_flow_style=False, allow_unicode=True)
                            )
                        except ImportError:
                            pass
                    elif output_format == "compact":
                        console.print(
                            f"{status_data.get('workflow_id', 'N/A')} | {status_data.get('status', 'N/A')} | {status_data.get('progress_percentage', 0)}%"
                        )
                    else:
                        format_workflow_status(status_data)
                else:
                    error = status_data.get("error_message", "Unknown error")
                    console.print(f"\n{CLIStyle.ERROR} Workflow failed: {error}")
                break

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        sys.stdout.write("\n")
        console.print(f"\n{CLIStyle.WARNING} Monitoring stopped by user")
    except httpx.RequestError as e:
        sys.stdout.write("\n")
        format_error(
            "Failed to connect to API",
            str(e),
            suggestions=["Check if API server is running: hyperagent system health"],
        )
    except httpx.HTTPStatusError as e:
        sys.stdout.write("\n")
        handle_api_error(e, f"workflow {workflow_id}")
    except Exception as e:
        sys.stdout.write("\n")
        format_error("Error monitoring workflow", str(e))


@click.group()
@click.version_option(version="1.0.0")
@click.option("--verbose", "-v", is_flag=True, help="Verbose output")
@click.option("--debug", "-d", is_flag=True, help="Debug mode")
@click.option(
    "--log-level", type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"]), help="Log level"
)
@click.pass_context
def cli(ctx: click.Context, verbose: bool, debug: bool, log_level: Optional[str]) -> None:
    """HyperAgent: AI Agent for Smart Contract Generation & Deployment"""
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose
    ctx.obj["debug"] = debug
    ctx.obj["log_level"] = log_level or ("DEBUG" if debug else ("INFO" if verbose else "WARNING"))

    # Configure logging if verbose or debug
    if debug or verbose:
        import logging

        logging.basicConfig(
            level=getattr(logging, ctx.obj["log_level"]),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        )


@cli.group()
def workflow() -> None:
    """Workflow management commands"""
    pass


# Register workflow commands from module
from hyperagent.cli.commands.workflow import register_workflow_commands

register_workflow_commands(workflow)


# ============================================================================
# COMMAND GROUP: CONTRACT
# ============================================================================


@cli.group()
def contract() -> None:
    """Contract management commands"""
    pass


# Register contract commands from module
from hyperagent.cli.commands.contract import register_contract_commands

register_contract_commands(contract)


# ============================================================================
# COMMAND GROUP: DEPLOYMENT
# ============================================================================


@cli.group()
def deployment() -> None:
    """Deployment management commands"""
    pass


# Register deployment commands from module
from hyperagent.cli.commands.deployment import register_deployment_commands

register_deployment_commands(deployment)


# ============================================================================
# COMMAND GROUP: SYSTEM
# ============================================================================


@cli.group()
def system() -> None:
    """System commands"""
    pass


# Register system commands from module
from hyperagent.cli.commands.system import register_system_commands

register_system_commands(system)


@system.group()
def config() -> None:
    """Configuration management commands"""
    pass


# Register config commands from module
from hyperagent.cli.commands.system import register_config_group

register_config_group(config)


# ============================================================================
# COMMAND GROUP: TEMPLATE
# ============================================================================


@cli.group()
def template() -> None:
    """Template management commands"""
    pass


# Register template commands from module
from hyperagent.cli.commands.template import register_template_commands

register_template_commands(template)


# ============================================================================
# COMMAND GROUP: NETWORK
# ============================================================================


@cli.group()
def network() -> None:
    """Network information and compatibility commands"""
    pass


@network.command()
def list() -> None:
    """[*] List all supported networks"""
    from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

    console.print(f"\n{CLIStyle.INFO} Supported Networks:\n")

    for network_name in NetworkFeatureManager.list_networks():
        config = NetworkFeatureManager.get_network_config(network_name)
        features = NetworkFeatureManager.get_features(network_name)

        # Count available features
        available = sum(1 for f, supported in features.items() if supported)
        total = len(features)

        console.print(f"  {CLIStyle.SUCCESS}{network_name}")
        console.print(f"    Chain ID: {config.get('chain_id', 'N/A')}")
        console.print(f"    Currency: {config.get('currency', 'N/A')}")
        console.print(f"    Features: {available}/{total} available\n")


@network.command()
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
    type=click.Choice(["hyperion_testnet", "hyperion_mainnet", "mantle_testnet", "mantle_mainnet"]),
    required=True,
    help="Target network",
)
@click.option(
    "--use-pef",
    is_flag=True,
    default=True,
    help="Use Hyperion PEF for parallel deployment (Hyperion only)",
)
@click.option("--max-parallel", type=int, default=10, help="Maximum parallel deployments")
@click.option("--private-key", "-k", help="Private key for deployment (or use config)")
def batch(
    contracts_file: click.File,
    network: str,
    use_pef: bool,
    max_parallel: int,
    private_key: Optional[str],
) -> None:
    """[>] Deploy multiple contracts in parallel using PEF"""
    import json

    try:
        contracts_data = json.load(contracts_file)
        contracts = contracts_data.get("contracts", [])

        if not contracts:
            format_error("No contracts found in file", "File must contain 'contracts' array")
            return

        console.print(f"{CLIStyle.INFO} Deploying {len(contracts)} contracts to {network}...")
        if use_pef and network.startswith("hyperion"):
            console.print(
                f"{CLIStyle.INFO} Using PEF for parallel deployment (max: {max_parallel})"
            )
        else:
            console.print(f"{CLIStyle.INFO} Using sequential deployment")

        api_url = get_api_url()

        async def deploy_batch_async():
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{api_url}/api/v1/deployments/batch",
                    json={
                        "contracts": contracts,
                        "use_pef": use_pef,
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


@deployment.command()
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


@deployment.command()
@click.option("--deployment-id", "-d", help="Deployment ID")
@click.option("--contract-address", "-a", help="Contract address (if not using deployment-id)")
@click.option("--function", "-f", required=True, help="Function name to call")
@click.option("--args", help="Function arguments as JSON array")
@click.option(
    "--network",
    "-n",
    type=click.Choice(["hyperion_testnet", "hyperion_mainnet", "mantle_testnet", "mantle_mainnet"]),
    help="Network (if not using deployment-id)",
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
                    "Contract address not found", suggestions=["Verify deployment ID is correct"]
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
                import json

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

        console.print(f"\n{CLIStyle.WARNING} Contract interaction API not yet implemented")
        console.print(
            f"{CLIStyle.INFO} Use Web3.py or ethers.js to interact with contract directly"
        )
        if deployment_id:
            console.print(
                f"{CLIStyle.INFO} Contract ABI available via: hyperagent contract view {deployment_data.get('contract_id', '')}"
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


# ============================================================================
# COMMAND GROUP: SYSTEM
# ============================================================================


@cli.group()
def system() -> None:
    """System commands"""
    pass


# Register system commands from module
from hyperagent.cli.commands.system import register_system_commands

register_system_commands(system)


@system.group()
def config() -> None:
    """Configuration management commands"""
    pass


# Register config commands from module
from hyperagent.cli.commands.system import register_config_group

register_config_group(config)


# ============================================================================
# COMMAND GROUP: TEMPLATE
# ============================================================================


@cli.group()
def network() -> None:
    """Network information and compatibility commands"""
    pass


@network.command()
def list() -> None:
    """[*] List all supported networks"""
    from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

    console.print(f"\n{CLIStyle.INFO} Supported Networks:\n")

    for network_name in NetworkFeatureManager.list_networks():
        config = NetworkFeatureManager.get_network_config(network_name)
        features = NetworkFeatureManager.get_features(network_name)

        # Count available features
        available = sum(1 for f, supported in features.items() if supported)
        total = len(features)

        console.print(f"  {CLIStyle.SUCCESS}{network_name}")
        console.print(f"    Chain ID: {config.get('chain_id', 'N/A')}")
        console.print(f"    Currency: {config.get('currency', 'N/A')}")
        console.print(f"    Features: {available}/{total} available\n")


@network.command()
@click.argument("network_name")
def info(network_name: str) -> None:
    """[*] Show network features and capabilities"""
    from hyperagent.blockchain.network_features import (
        NETWORK_FEATURES,
        NetworkFeature,
        NetworkFeatureManager,
    )

    if network_name not in NETWORK_FEATURES:
        console.print(f"{CLIStyle.ERROR} Network '{network_name}' not found")
        console.print(f"{CLIStyle.INFO} Use 'hyperagent network list' to see available networks")
        return

    config = NetworkFeatureManager.get_network_config(network_name)
    features = NetworkFeatureManager.get_features(network_name)

    console.print(f"\n{CLIStyle.INFO} Network: {network_name}")
    console.print(f"  Chain ID: {config.get('chain_id', 'N/A')}")
    console.print(f"  Currency: {config.get('currency', 'N/A')}")
    console.print(f"  RPC URL: {config.get('rpc_url', 'N/A')}")
    console.print(f"  Explorer: {config.get('explorer', 'N/A')}")

    console.print(f"\n{CLIStyle.INFO} Available Features:")
    feature_names = {
        NetworkFeature.PEF: "PEF (Parallel Execution Framework)",
        NetworkFeature.METISVM: "MetisVM Optimizations",
        NetworkFeature.EIGENDA: "EigenDA",
        NetworkFeature.BATCH_DEPLOYMENT: "Batch Deployment",
        NetworkFeature.FLOATING_POINT: "Floating-Point Operations",
        NetworkFeature.AI_INFERENCE: "AI Inference",
    }

    for feature, supported in features.items():
        status = CLIStyle.SUCCESS + "[+]" if supported else CLIStyle.ERROR + "[-]"
        console.print(f"  {status} {feature_names.get(feature, feature.value)}")

    # Show fallbacks
    console.print(f"\n{CLIStyle.INFO} Fallbacks:")
    for feature in NetworkFeature:
        if not features.get(feature, False):
            fallback = NetworkFeatureManager.get_fallback_strategy(network_name, feature)
            if fallback:
                console.print(f"  - {feature_names.get(feature, feature.value)}: {fallback}")


@network.command()
@click.argument("network_name")
def features(network_name: str) -> None:
    """[*] Show available features for a network"""
    from hyperagent.blockchain.network_features import (
        NETWORK_FEATURES,
        NetworkFeature,
        NetworkFeatureManager,
    )

    if network_name not in NETWORK_FEATURES:
        console.print(f"{CLIStyle.ERROR} Network '{network_name}' not found")
        return

    features = NetworkFeatureManager.get_features(network_name)

    console.print(f"\n{CLIStyle.INFO} Features for {network_name}:\n")

    feature_descriptions = {
        NetworkFeature.PEF: "Parallel Execution Framework - 10-50x faster batch deployments",
        NetworkFeature.METISVM: "MetisVM optimizations - floating-point, AI inference, GPU acceleration",
        NetworkFeature.EIGENDA: "EigenDA data availability - cost-efficient metadata storage",
        NetworkFeature.BATCH_DEPLOYMENT: "Batch deployment support - deploy multiple contracts",
        NetworkFeature.FLOATING_POINT: "Floating-point operations - native decimal support",
        NetworkFeature.AI_INFERENCE: "On-chain AI inference - run ML models on-chain",
    }

    for feature, supported in features.items():
        status = "Available" if supported else "Not Available"
        style = CLIStyle.SUCCESS if supported else CLIStyle.WARNING
        console.print(f"  {style}{feature.value}: {status}")
        if feature_descriptions.get(feature):
            console.print(f"    {feature_descriptions[feature]}")


@network.command()
@click.argument("network_name")
def test(network_name: str) -> None:
    """[*] Test network connectivity and features"""
    from rich.table import Table

    from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager
    from hyperagent.blockchain.networks import NetworkManager

    console.print(f"\n{CLIStyle.INFO} Testing network: {network_name}\n")

    table = Table(title="Network Test Results")
    table.add_column("Test", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Details", style="yellow")

    # Test 1: Network exists
    try:
        config = NetworkFeatureManager.get_network_config(network_name)
        table.add_row(
            "Network Configuration",
            "[green][+] Found[/green]",
            f"Chain ID: {config.get('chain_id', 'N/A')}",
        )
    except:
        table.add_row(
            "Network Configuration", "[red][-] Not Found[/red]", "Network not in registry"
        )
        console.print(table)
        return

    # Test 2: RPC connectivity
    try:
        network_manager = NetworkManager()
        w3 = network_manager.get_web3(network_name)
        block_number = w3.eth.block_number
        table.add_row(
            "RPC Connectivity", "[green][+] Connected[/green]", f"Latest block: {block_number}"
        )
    except Exception as e:
        table.add_row("RPC Connectivity", "[red][-] Failed[/red]", str(e)[:50])

    # Test 3: Feature availability
    features = NetworkFeatureManager.get_features(network_name)
    available = sum(1 for f, supported in features.items() if supported)
    total = len(features)
    table.add_row(
        "Features", f"[green][+] {available}/{total}[/green]", f"{available} features available"
    )

    # Test 4: Wallet balance (if private key configured)
    if settings.private_key:
        try:
            from eth_account import Account

            account = Account.from_key(settings.private_key)
            balance = w3.eth.get_balance(account.address)
            balance_eth = w3.from_wei(balance, "ether")
            table.add_row(
                "Wallet Balance",
                "[green][+] Funded[/green]" if balance > 0 else "[yellow][!] Zero[/yellow]",
                f"{balance_eth:.6f} ETH",
            )
        except Exception as e:
            table.add_row("Wallet Balance", "[red][-] Error[/red]", str(e)[:50])
    else:
        table.add_row(
            "Wallet Balance", "[yellow][!] Not Configured[/yellow]", "PRIVATE_KEY not set"
        )

    console.print(table)


# ============================================================================
# COMMAND GROUP: CONFIG
# ============================================================================


@system.group()
def config() -> None:
    """Configuration management commands"""
    pass


# Register config commands from module
from hyperagent.cli.commands.system import register_config_group

register_config_group(config)


# ============================================================================
# COMMAND GROUP: TEMPLATE
# ============================================================================


@cli.group()
def template() -> None:
    """Template management commands"""
    pass


# Register template commands from module
from hyperagent.cli.commands.template import register_template_commands

register_template_commands(template)


# ============================================================================
# COMMAND GROUP: TEMPLATE
# ============================================================================


@cli.group()
def template() -> None:
    """Template management commands"""
    pass


# Register template commands from module
from hyperagent.cli.commands.template import register_template_commands

register_template_commands(template)


# ============================================================================
# COMMAND GROUP: EXPORT/IMPORT
# ============================================================================


@workflow.command()
@click.option("--workflow-id", "-w", required=True)
@click.option("--output", "-o", type=click.Path(), help="Output file (default: stdout)")
@click.option("--format", type=click.Choice(["json", "yaml"]), default="json")
def export(workflow_id: str, output: Optional[str], format: str):
    """[>] Export workflow to file"""
    try:
        api_url = get_api_url()

        async def get_workflow_data():
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Get workflow
                workflow_resp = await client.get(f"{api_url}/api/v1/workflows/{workflow_id}")
                workflow_resp.raise_for_status()
                workflow_data = workflow_resp.json()

                # Get contracts
                contracts_resp = await client.get(
                    f"{api_url}/api/v1/workflows/{workflow_id}/contracts"
                )
                contracts_data = (
                    contracts_resp.json()
                    if contracts_resp.status_code == 200
                    else {"contracts": []}
                )

                # Get deployments
                deployments_resp = await client.get(
                    f"{api_url}/api/v1/workflows/{workflow_id}/deployments"
                )
                deployments_data = (
                    deployments_resp.json()
                    if deployments_resp.status_code == 200
                    else {"deployments": []}
                )

                return {
                    "workflow": workflow_data,
                    "contracts": contracts_data.get("contracts", []),
                    "deployments": deployments_data.get("deployments", []),
                }

        data = asyncio.run(get_workflow_data())

        if format == "json":
            import json

            output_str = json.dumps(data, indent=2, default=str)
        else:
            try:
                import yaml

                output_str = yaml.dump(data, default_flow_style=False, allow_unicode=True)
            except ImportError:
                format_error("YAML format requires PyYAML", "Install with: pip install pyyaml")
                return

        if output:
            with open(output, "w") as f:
                f.write(output_str)
            format_success(f"Workflow exported to {output}")
        else:
            console.print(output_str)

    except httpx.RequestError as e:
        format_error(
            "Failed to connect to API",
            str(e),
            suggestions=["Check if API server is running: hyperagent system health"],
        )
    except httpx.HTTPStatusError as e:
        handle_api_error(e, f"workflow {workflow_id}")
    except Exception as e:
        format_error("Failed to export workflow", str(e))


# Contract export and verify commands are registered via register_contract_commands above


# ============================================================================
# COMMAND GROUP: QUICK ACTIONS
# ============================================================================


@cli.group()
def quick() -> None:
    """Quick action commands"""
    pass


@quick.command()
@click.argument("description")
@click.option("--network", "-n", default="hyperion_testnet", help="Network")
@click.option("--watch", "-w", is_flag=True, help="Watch progress")
def create(description: str, network: str, watch: bool) -> None:
    """[>] Quick workflow creation with defaults"""
    # Quick workflow creation - reuse the workflow create logic
    print_banner()

    console.print(f"\n{CLIStyle.INFO} Quick workflow creation...")
    console.print(f"{CLIStyle.INFO} Network: {network}")
    console.print(f"{CLIStyle.INFO} Description: {description[:60]}...")

    try:
        api_url = get_api_url()

        async def create_workflow_async():
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{api_url}/api/v1/workflows/generate",
                    json={
                        "nlp_input": description,
                        "network": network,
                        "contract_type": "Custom",
                        "skip_audit": False,
                        "skip_deployment": False,
                        "optimize_for_metisvm": False,
                        "enable_floating_point": False,
                        "enable_ai_inference": False,
                    },
                )
                response.raise_for_status()
                return response.json()

        with Progress(*create_progress_columns(), console=console) as progress:
            task = progress.add_task(f"{CLIStyle.WAIT} Creating workflow...", total=None)
            result = asyncio.run(create_workflow_async())
            progress.update(task, completed=True)

        workflow_id = result.get("workflow_id")

        if watch:
            monitor_workflow_progress(workflow_id, api_url)
        else:
            format_success(
                f"Workflow created: {workflow_id}",
                f"Status: {result.get('status')}\nUse 'hyperagent workflow status --workflow-id {workflow_id}' to check progress",
            )

    except httpx.RequestError as e:
        format_error(
            "Failed to connect to API",
            str(e),
            suggestions=["Check if API server is running: hyperagent system health"],
        )
    except httpx.HTTPStatusError as e:
        handle_api_error(e, "quick workflow creation")
    except Exception as e:
        format_error("Failed to create workflow", str(e))


# ============================================================================
# COMMAND GROUP: STATS
# ============================================================================


@cli.group()
def stats() -> None:
    """Statistics and analytics"""
    pass


@stats.command()
def show() -> None:
    """[*] Show usage statistics"""
    try:
        api_url = get_api_url()

        async def get_stats_async():
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Try to get stats from API if endpoint exists
                try:
                    response = await client.get(f"{api_url}/api/v1/stats")
                    if response.status_code == 200:
                        return response.json()
                except:
                    pass
                return None

        stats_data = asyncio.run(get_stats_async())

        if stats_data:
            from rich.table import Table

            table = Table(title="Usage Statistics")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green")

            for key, value in stats_data.items():
                table.add_row(key.replace("_", " ").title(), str(value))
            console.print(table)
        else:
            console.print(f"{CLIStyle.INFO} Statistics endpoint not available")
            console.print(f"{CLIStyle.INFO} Query database directly for statistics")

    except Exception as e:
        format_error("Failed to get statistics", str(e))


if __name__ == "__main__":
    cli()
