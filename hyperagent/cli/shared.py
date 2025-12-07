"""Shared utilities for CLI commands"""

import asyncio
import platform
import sys
import time
from typing import Any, List

import httpx
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn

from hyperagent.cli.formatters import (
    CLIStyle,
    format_error,
    format_progress_bar_windows_safe,
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
                    # Final fallback: use ASCII only
                    sys.stdout.write(
                        f"\r[...] Workflow: {progress}% - {stage}".encode("ascii", "replace").decode("ascii")
                    )
                    sys.stdout.flush()

                last_progress = progress
                last_stage = stage

            # Check if completed or failed
            if status in ["completed", "failed", "cancelled"]:
                elapsed = time.time() - start_time
                console.print(f"\n\n{CLIStyle.INFO} Workflow {status} in {elapsed:.1f}s")
                if status == "completed":
                    console.print(f"{CLIStyle.SUCCESS} Workflow completed successfully!")
                elif status == "failed":
                    error = status_data.get("error", "Unknown error")
                    console.print(f"{CLIStyle.ERROR} Workflow failed: {error}")
                break

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        console.print(f"\n\n{CLIStyle.INFO} Monitoring stopped by user")
    except httpx.RequestError as e:
        format_error(
            "Failed to connect to API",
            str(e),
            suggestions=["Check if API server is running: hyperagent system health"],
        )
    except httpx.HTTPStatusError as e:
        handle_api_error(e, f"workflow {workflow_id}")
    except Exception as e:
        format_error("Error monitoring workflow", str(e))

