"""Workflow management commands"""

import asyncio
from typing import Optional

import click
import httpx
from rich.progress import Progress

from hyperagent.cli.formatters import (
    CLIStyle,
    format_error,
    format_success,
    format_workflow_list,
    format_workflow_status,
    get_stage_name,
    handle_api_error,
    print_banner,
)
from hyperagent.cli.shared import (
    console,
    create_progress_columns,
    get_api_url,
    monitor_workflow_progress,
)


def register_workflow_commands(workflow_group: click.Group) -> None:
    """Register all workflow commands with the workflow group"""

    @workflow_group.command()
    @click.option(
        "--description", "-d", help="NLP description of contract (required if not interactive)"
    )
    @click.option("--interactive", "-i", is_flag=True, help="Interactive mode")
    @click.option("--watch", "-w", is_flag=True, help="Watch progress in real-time")
    @click.option("--follow", "-f", is_flag=True, help="Follow progress (alias for --watch)")
    @click.option(
        "--network",
        "-n",
        type=click.Choice(
            [
                "hyperion_testnet",
                "hyperion_mainnet",
                "mantle_testnet",
                "mantle_mainnet",
                "avalanche_fuji",
                "avalanche_mainnet",
            ]
        ),
        default="hyperion_testnet",
        help="Target blockchain",
    )
    @click.option(
        "--wallet-address",
        "-w",
        help="Wallet address for deployment (required for all workflows)",
    )
    @click.option(
        "--type",
        "-t",
        type=click.Choice(["ERC20", "ERC721", "ERC1155", "Custom"]),
        default="Custom",
        help="Contract type",
    )
    @click.option("--name", help="Workflow name (optional)")
    @click.option("--no-audit", is_flag=True, help="Skip security audit")
    @click.option("--no-deploy", is_flag=True, help="Skip deployment")
    @click.option("--optimize-metisvm", is_flag=True, help="Optimize for MetisVM (Hyperion only)")
    @click.option("--enable-fp", is_flag=True, help="Enable floating-point operations")
    @click.option("--enable-ai", is_flag=True, help="Enable AI inference support")
    @click.option("--confirm-steps", is_flag=True, help="Confirm each step")
    def create(
        description: Optional[str],
        interactive: bool,
        watch: bool,
        follow: bool,
        network: str,
        type: str,
        name: Optional[str],
        no_audit: bool,
        no_deploy: bool,
        optimize_metisvm: bool,
        enable_fp: bool,
        enable_ai: bool,
        confirm_steps: bool,
        wallet_address: Optional[str],
    ) -> None:
        """[>] Create workflow to generate and deploy smart contract"""
        print_banner()

        # Interactive mode
        if interactive:
            from hyperagent.cli.interactive import run_interactive_prompts

            description, network, type, wallet_address, options = run_interactive_prompts()
            no_audit = options.get("skip_audit", False)
            no_deploy = options.get("skip_deployment", False)
            optimize_metisvm = options.get("optimize_metisvm", False)
            enable_fp = options.get("enable_fp", False)
            enable_ai = options.get("enable_ai", False)
        elif not description:
            format_error(
                "Description required",
                "Use --description or --interactive",
                suggestions=[
                    "Use --description to provide description directly",
                    "Use --interactive for guided workflow creation",
                ],
            )
            return

        # Step-by-step confirmation
        if confirm_steps:
            if not click.confirm(f"{CLIStyle.INFO} Step 1: Generate contract?", default=True):
                return
            if not click.confirm(f"{CLIStyle.INFO} Step 2: Run security audit?", default=True):
                no_audit = True
            if not click.confirm(f"{CLIStyle.INFO} Step 3: Deploy to blockchain?", default=True):
                no_deploy = True

        # Validate wallet address
        if not wallet_address:
            format_error(
                "Wallet address required",
                "All workflows now require a wallet address for deployment",
                suggestions=[
                    "Use --wallet-address to provide your wallet address",
                    "Format: 0x followed by 40 hexadecimal characters",
                ],
            )
            return

        console.print(f"\n{CLIStyle.INFO} Creating workflow...")
        console.print(f"{CLIStyle.INFO} Network: {network}")
        console.print(f"{CLIStyle.INFO} Contract Type: {type}")
        console.print(f"{CLIStyle.INFO} Wallet: {wallet_address[:10]}...{wallet_address[-8:]}")
        console.print(f"{CLIStyle.INFO} Description: {description[:60]}...")

        try:
            # Call API to create workflow
            api_url = get_api_url()

            async def create_workflow_async():
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{api_url}/api/v1/workflows/generate",
                        json={
                            "nlp_input": description,
                            "network": network,
                            "contract_type": type,
                            "name": name,
                            "wallet_address": wallet_address,
                            "skip_audit": no_audit,
                            "skip_deployment": no_deploy,
                            "optimize_for_metisvm": optimize_metisvm,
                            "enable_floating_point": enable_fp,
                            "enable_ai_inference": enable_ai,
                        },
                    )
                    response.raise_for_status()
                    return response.json()

            with Progress(*create_progress_columns(), console=console) as progress:
                task = progress.add_task(f"{CLIStyle.WAIT} Creating workflow...", total=None)
                result = asyncio.run(create_workflow_async())
                progress.update(task, completed=True)

            workflow_id = result.get("workflow_id")
            status = result.get("status")

            if watch or follow:
                monitor_workflow_progress(workflow_id, api_url)
            else:
                format_success(
                    f"Workflow created: {workflow_id}",
                    f"Status: {status}\nUse 'hyperagent workflow status --workflow-id {workflow_id}' to check progress",
                )

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=[
                    "Check if API server is running: hyperagent system health",
                    "Verify API URL in configuration",
                    "Check network connectivity",
                ],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, "workflow creation")
        except Exception as e:
            format_error("Failed to create workflow", str(e))

    @workflow_group.command()
    @click.option("--workflow-id", "-w", required=True, help="Workflow ID")
    @click.option("--watch", is_flag=True, help="Watch progress continuously")
    @click.option("--follow", is_flag=True, help="Follow progress (alias for --watch)")
    @click.option(
        "--poll-interval", type=int, default=2, help="Polling interval in seconds (default: 2)"
    )
    @click.option(
        "--format",
        type=click.Choice(["table", "json", "yaml", "compact"]),
        default="table",
        help="Output format",
    )
    def status(workflow_id: str, watch: bool, follow: bool, poll_interval: int, format: str):
        """[*] Check workflow status"""
        try:
            api_url = get_api_url()

            async def get_status_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/workflows/{workflow_id}")
                    response.raise_for_status()
                    return response.json()

            if watch or follow:
                monitor_workflow_progress(workflow_id, api_url, poll_interval, format)
            else:
                status_data = asyncio.run(get_status_async())

                if format == "json":
                    import json

                    console.print(json.dumps(status_data, indent=2, default=str))
                elif format == "yaml":
                    try:
                        import yaml

                        console.print(
                            yaml.dump(status_data, default_flow_style=False, allow_unicode=True)
                        )
                    except ImportError:
                        format_error(
                            "YAML format requires PyYAML", "Install with: pip install pyyaml"
                        )
                elif format == "compact":
                    console.print(
                        f"{status_data.get('workflow_id', 'N/A')} | {status_data.get('status', 'N/A')} | {status_data.get('progress_percentage', 0)}%"
                    )
                else:
                    format_workflow_status(status_data)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=[
                    "Check if API server is running: hyperagent system health",
                    "Verify API URL in configuration",
                ],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"workflow {workflow_id}")
        except Exception as e:
            format_error("Failed to get workflow status", str(e))

    @workflow_group.command()
    @click.option("--workflow-id", "-w", required=True, help="Workflow ID to cancel")
    def cancel(workflow_id: str) -> None:
        """[!] Cancel running workflow"""
        try:
            api_url = get_api_url()

            async def cancel_workflow_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(f"{api_url}/api/v1/workflows/{workflow_id}/cancel")
                    response.raise_for_status()
                    return response.json()

            result = asyncio.run(cancel_workflow_async())
            format_success(f"Workflow cancelled: {workflow_id}")

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"workflow {workflow_id}")
        except Exception as e:
            format_error("Failed to cancel workflow", str(e))

    @workflow_group.command()
    @click.option(
        "--status-filter",
        "-s",
        type=click.Choice(
            ["created", "generating", "auditing", "testing", "deploying", "completed", "failed"]
        ),
        help="Filter by status",
    )
    @click.option("--search", help="Search in description/name")
    @click.option("--network", "-n", help="Filter by network")
    @click.option("--limit", "-l", type=int, default=10, help="Number of workflows to display")
    @click.option(
        "--format", type=click.Choice(["table", "json"]), default="table", help="Output format"
    )
    def list(
        status_filter: Optional[str],
        search: Optional[str],
        network: Optional[str],
        limit: int,
        format: str,
    ) -> None:
        """[*] List workflows with filters"""
        try:
            api_url = get_api_url()

            async def get_workflows_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    params = {"limit": limit}
                    if status_filter:
                        params["status"] = status_filter
                    if search:
                        params["search"] = search
                    if network:
                        params["network"] = network

                    # Try to call workflows list endpoint
                    response = await client.get(f"{api_url}/api/v1/workflows", params=params)
                    if response.status_code == 200:
                        return response.json()
                    else:
                        # Fallback if endpoint not implemented
                        return {"workflows": []}

            workflows_data = asyncio.run(get_workflows_async())
            workflows = workflows_data.get("workflows", [])

            if format == "json":
                import json

                console.print(json.dumps(workflows, indent=2, default=str))
            else:
                if not workflows:
                    console.print(f"{CLIStyle.INFO} No workflows found")
                    if status_filter or search or network:
                        console.print(
                            f"{CLIStyle.INFO} Try removing filters or check API endpoint availability"
                        )
                else:
                    format_workflow_list(workflows)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, "workflow list")
        except Exception as e:
            format_error("Failed to list workflows", str(e))

    @workflow_group.command()
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
