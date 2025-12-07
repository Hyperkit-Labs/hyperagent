"""System management commands"""

import asyncio
from pathlib import Path

import click
import httpx
from rich.table import Table

from hyperagent.cli.formatters import CLIStyle, format_error
from hyperagent.cli.shared import console, get_api_url
from hyperagent.core.config import settings


def mask_sensitive(value: str) -> str:
    """Mask sensitive configuration values"""
    if not value:
        return "Not set"
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}...{value[-4:]}"


def register_system_commands(system_group: click.Group) -> None:
    """Register all system commands with the system group"""

    @system_group.command()
    def health() -> None:
        """[*] Check system health"""
        console.print(f"{CLIStyle.INFO} Checking system health...")

        try:
            api_url = get_api_url()

            async def check_health_async():
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{api_url}/api/v1/health/")
                    response.raise_for_status()
                    return response.json()

            health_data = asyncio.run(check_health_async())

            status = health_data.get("status", "unknown")
            if status == "healthy":
                console.print(f"{CLIStyle.SUCCESS} API: Healthy")
            else:
                console.print(f"{CLIStyle.WARNING} API: {status}")

        except httpx.RequestError:
            console.print(f"{CLIStyle.ERROR} API: Not reachable")
        except Exception as e:
            console.print(f"{CLIStyle.ERROR} Health check failed: {e}")

    @system_group.command()
    def version() -> None:
        """[*] Display version information"""
        console.print(f"HyperAgent v1.0.0")
        console.print(f"Python: 3.10+")
        console.print(f"Web3: Enabled (Hyperion + Mantle)")
        console.print(f"LLM: Gemini (OpenAI Fallback)")

    @system_group.command()
    @click.option(
        "--shell", type=click.Choice(["bash", "zsh", "fish"]), required=True, help="Shell type"
    )
    def install_completion(shell: str) -> None:
        """[*] Install shell completion"""
        import os
        import shutil

        script_path = Path(__file__).parent.parent.parent.parent / "scripts" / "completion" / f"{shell}.sh"

        if not script_path.exists():
            format_error(f"Completion script not found: {script_path}")
            return

        console.print(f"{CLIStyle.INFO} Installation instructions for {shell}:")
        console.print()

        if shell == "bash":
            console.print(f"  Add to ~/.bashrc:")
            console.print(f"    source {script_path.absolute()}")
            console.print()
            console.print(f"  Or run:")
            console.print(f"    echo 'source {script_path.absolute()}' >> ~/.bashrc")
        elif shell == "zsh":
            console.print(f"  Add to ~/.zshrc:")
            console.print(f"    source {script_path.absolute()}")
            console.print()
            console.print(f"  Or run:")
            console.print(f"    echo 'source {script_path.absolute()}' >> ~/.zshrc")
        elif shell == "fish":
            fish_completions = Path.home() / ".config" / "fish" / "completions"
            fish_completions.mkdir(parents=True, exist_ok=True)
            target = fish_completions / "hyperagent.fish"

            try:
                shutil.copy(script_path, target)
                from hyperagent.cli.formatters import format_success

                format_success(f"Completion installed to {target}")
                console.print(f"{CLIStyle.INFO} Restart your shell or run: source {target}")
            except Exception as e:
                format_error(
                    f"Failed to install completion: {e}",
                    suggestions=[f"Manually copy {script_path} to {target}"],
                )


def register_config_group(config_group: click.Group) -> None:
    """Register config group commands"""
    """Register config commands with the config group"""

    @config_group.command()
    def show():
        """[*] Show current configuration"""
        table = Table(title="HyperAgent Configuration")
        table.add_column("Setting", style="cyan")
        table.add_column("Value", style="green")
        table.add_column("Source", style="yellow")

        config_items = [
            ("API Host", settings.api_host, "env"),
            ("API Port", settings.api_port, "env"),
            ("Database URL", mask_sensitive(settings.database_url), "env"),
            ("Gemini API Key", mask_sensitive(settings.gemini_api_key), "env"),
            ("OpenAI API Key", mask_sensitive(settings.openai_api_key), "env"),
            ("Private Key", mask_sensitive(settings.private_key), "env"),
            ("Default Network", getattr(settings, "default_network", "N/A"), "env"),
        ]

        for name, value, source in config_items:
            table.add_row(name, str(value), source)

        console.print(table)

    @config_group.command()
    def validate():
        """[*] Validate configuration"""
        table = Table(title="Configuration Validation")
        table.add_column("Check", style="cyan")
        table.add_column("Status", style="green")
        table.add_column("Message", style="yellow")

        # Check required settings
        checks = [
            ("Database URL", settings.database_url, "Required for data persistence"),
            ("Gemini API Key", settings.gemini_api_key, "Required for LLM generation"),
            ("Private Key", settings.private_key, "Required for deployments"),
        ]

        for name, value, message in checks:
            if value:
                table.add_row(name, "[green][+] Set[/green]", "OK")
            else:
                table.add_row(name, "[red][-] Missing[/red]", message)

        # Test API connectivity
        try:
            api_url = get_api_url()

            async def test_api():
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{api_url}/api/v1/health/")
                    return response.status_code == 200

            if asyncio.run(test_api()):
                table.add_row("API Connectivity", "[green][+] Connected[/green]", "API is reachable")
            else:
                table.add_row("API Connectivity", "[red][-] Failed[/red]", "API not responding")
        except:
            table.add_row("API Connectivity", "[red][-] Failed[/red]", "Cannot connect to API")

        console.print(table)

