"""Template management commands"""

import asyncio
from typing import Optional

import click
import httpx
from rich.table import Table

from hyperagent.cli.formatters import (
    CLIStyle,
    format_contract_code,
    format_error,
    handle_api_error,
)
from hyperagent.cli.shared import console, get_api_url


def register_template_commands(template_group: click.Group) -> None:
    """Register all template commands with the template group"""

    @template_group.command()
    @click.option("--search", "-s", help="Search query")
    @click.option("--format", type=click.Choice(["table", "json"]), default="table")
    def list(search: Optional[str], format: str) -> None:
        """[*] List available templates"""
        try:
            api_url = get_api_url()

            async def get_templates_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    url = f"{api_url}/api/v1/templates"
                    if search:
                        url += f"?search={search}"
                    response = await client.get(url)
                    response.raise_for_status()
                    return response.json()

            templates_data = asyncio.run(get_templates_async())
            # API returns a list directly, not a dict
            if type(templates_data).__name__ == "list":
                templates = templates_data
            elif type(templates_data).__name__ == "dict":
                templates = templates_data.get("templates", [])
            else:
                templates = []

            if format == "json":
                import json

                console.print(json.dumps(templates, indent=2, default=str))
            else:
                table = Table(title="Contract Templates")
                table.add_column("Name", style="cyan")
                table.add_column("Type", style="green")
                table.add_column("Description", style="yellow")

                for template in templates:
                    table.add_row(
                        template.get("name", "N/A"),
                        template.get("contract_type", "N/A"),
                        (
                            template.get("description", "N/A")[:50] + "..."
                            if len(template.get("description", "")) > 50
                            else template.get("description", "N/A")
                        ),
                    )
                console.print(table)

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, "template list")
        except Exception as e:
            format_error("Failed to list templates", str(e))

    @template_group.command()
    @click.argument("name")
    @click.option("--format", type=click.Choice(["code", "json", "both"]), default="code")
    def show(name: str, format: str) -> None:
        """[*] Show template details"""
        try:
            api_url = get_api_url()

            async def get_template_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{api_url}/api/v1/templates/{name}")
                    response.raise_for_status()
                    return response.json()

            template_data = asyncio.run(get_template_async())

            if format in ["code", "both"]:
                template_code = template_data.get("template_code")
                if template_code:
                    format_contract_code(template_code)
                else:
                    console.print(f"{CLIStyle.WARNING} Template code not available")

            if format in ["json", "both"]:
                import json

                console.print("\n[bold blue]Template Metadata:[/bold blue]")
                console.print(json.dumps(template_data, indent=2, default=str))

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, f"template {name}")
        except Exception as e:
            format_error("Failed to get template", str(e))

    @template_group.command()
    @click.option("--query", "-q", required=True, help="Search query")
    def search(query: str):
        """[?] Search templates"""
        try:
            api_url = get_api_url()

            async def search_templates_async():
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # Search endpoint uses POST, not GET
                    response = await client.post(
                        f"{api_url}/api/v1/templates/search", json={"query": query}
                    )
                    response.raise_for_status()
                    return response.json()

            results = asyncio.run(search_templates_async())
            # API returns a list directly, not a dict
            if type(results).__name__ == "list":
                templates = results
            elif type(results).__name__ == "dict":
                templates = results.get("templates", [])
            else:
                templates = []

            if templates:
                table = Table(title=f"Template Search Results: '{query}'")
                table.add_column("Name", style="cyan")
                table.add_column("Type", style="green")
                table.add_column("Description", style="yellow")
                table.add_column("Score", style="magenta")

                for template in templates:
                    table.add_row(
                        template.get("name", "N/A"),
                        template.get("contract_type", "N/A"),
                        (
                            template.get("description", "N/A")[:50] + "..."
                            if len(template.get("description", "")) > 50
                            else template.get("description", "N/A")
                        ),
                        str(template.get("score", "N/A")),
                    )
                console.print(table)
            else:
                console.print(f"{CLIStyle.INFO} No templates found for query: {query}")

        except httpx.RequestError as e:
            format_error(
                "Failed to connect to API",
                str(e),
                suggestions=["Check if API server is running: hyperagent system health"],
            )
        except httpx.HTTPStatusError as e:
            handle_api_error(e, "template search")
        except Exception as e:
            format_error("Failed to search templates", str(e))

