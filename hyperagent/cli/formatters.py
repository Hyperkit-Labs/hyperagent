"""CLI output formatters with ASCII styling"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn
from rich.syntax import Syntax
from rich.table import Table
from rich.tree import Tree

console = Console()


class CLIStyle:
    """ASCII CLI styling rules"""

    SUCCESS = "[+]"
    ERROR = "[-]"
    WARNING = "[!]"
    INFO = "[*]"
    WAIT = "[...]"
    SEARCH = "[?]"
    PROGRESS = "[>]"


def print_banner() -> None:
    """
    Print HyperAgent CLI banner

    Concept: Display ASCII art banner with version info
    Uses ASCII characters for Windows compatibility
    """
    import platform
    import sys

    # Use ASCII on Windows, Unicode on other platforms
    if platform.system() == "Windows":
        banner = """
    ===============================================================
                    HyperAgent CLI                         
         AI Agent for Smart Contract Generation            
                    Version 1.0.0                          
    ===============================================================
    """
    else:
        banner = """
    ╔═══════════════════════════════════════════════════════════╗
    ║                    HyperAgent CLI                         ║
    ║         AI Agent for Smart Contract Generation            ║
    ║                    Version 1.0.0                          ║
    ╚═══════════════════════════════════════════════════════════╝
    """

    try:
        console.print(banner, style="bold cyan")
    except UnicodeEncodeError:
        # Fallback to ASCII if encoding fails
        banner = """
    ===============================================================
                    HyperAgent CLI                         
         AI Agent for Smart Contract Generation            
                    Version 1.0.0                          
    ===============================================================
    """
        console.print(banner, style="bold cyan")


def format_workflow_status(workflow_data: Dict[str, Any]) -> None:
    """
    Format workflow status display

    Concept: Display workflow information in a structured table
    Logic:
        1. Create table with workflow fields
        2. Add status indicators
        3. Display progress bar if in progress
    """
    table = Table(title=f"Workflow Status: {workflow_data.get('workflow_id', 'Unknown')}")
    table.add_column("Field", style="cyan", width=20)
    table.add_column("Value", style="green")

    # Status with color coding
    status = workflow_data.get("status", "unknown")
    status_style = "green" if status == "completed" else "red" if status == "failed" else "yellow"
    table.add_row("Status", f"[{status_style}]{status}[/{status_style}]")

    # Progress
    progress = workflow_data.get("progress_percentage", 0)
    table.add_row("Progress", f"{progress}%")

    # Network
    table.add_row("Network", workflow_data.get("network", "N/A"))

    # Timestamps
    if workflow_data.get("created_at"):
        table.add_row("Created", workflow_data["created_at"])
    if workflow_data.get("updated_at"):
        table.add_row("Updated", workflow_data["updated_at"])
    if workflow_data.get("completed_at"):
        table.add_row("Completed", workflow_data["completed_at"])

    # Error message if failed
    if workflow_data.get("error_message"):
        table.add_row("Error", f"[red]{workflow_data['error_message']}[/red]")

    # Retry count
    if workflow_data.get("retry_count", 0) > 0:
        table.add_row("Retries", str(workflow_data["retry_count"]))

    console.print(table)

    # Progress bar if in progress
    if status in ["generating", "auditing", "testing", "deploying"]:
        with console.status(f"{CLIStyle.WAIT} {status.title()}..."):
            pass


def format_workflow_list(workflows: List[Dict[str, Any]]) -> None:
    """
    Format workflow list display

    Concept: Display multiple workflows in a table
    Logic:
        1. Create table with key fields
        2. Add rows for each workflow
        3. Color-code by status
    """
    if not workflows:
        console.print(f"{CLIStyle.INFO} No workflows found")
        return

    table = Table(title="Workflows")
    table.add_column("ID", style="cyan", width=36)
    table.add_column("Status", style="yellow", width=15)
    table.add_column("Network", style="green", width=20)
    table.add_column("Progress", style="blue", width=10)
    table.add_column("Created", style="magenta", width=20)

    for wf in workflows:
        workflow_id = str(wf.get("id", ""))[:36]
        status = wf.get("status", "unknown")
        network = wf.get("network", "N/A")
        progress = f"{wf.get('progress_percentage', 0)}%"
        created = wf.get("created_at", "N/A")

        # Truncate created timestamp
        if created and len(created) > 19:
            created = created[:19]

        table.add_row(workflow_id, status, network, progress, created)

    console.print(table)


def format_contract_code(contract_code: str, language: str = "solidity") -> None:
    """
    Format contract code with syntax highlighting

    Concept: Display Solidity code with syntax highlighting
    Logic:
        1. Use Rich Syntax for highlighting
        2. Display in a panel
        3. Add line numbers
    """
    syntax = Syntax(contract_code, language, theme="monokai", line_numbers=True, word_wrap=True)

    panel = Panel(syntax, title="[bold blue]Contract Code[/bold blue]", border_style="blue")

    console.print(panel)


def format_audit_report(audit_result: Dict[str, Any]) -> None:
    """
    Format security audit report

    Concept: Display audit findings in structured format
    Logic:
        1. Create summary table with counts
        2. Display risk score
        3. List vulnerabilities by severity
        4. Show tool-specific findings
    """
    # Summary table
    summary_table = Table(title="Audit Summary")
    summary_table.add_column("Severity", style="bold")
    summary_table.add_column("Count", justify="right")

    critical = audit_result.get("critical_count", 0)
    high = audit_result.get("high_count", 0)
    medium = audit_result.get("medium_count", 0)
    low = audit_result.get("low_count", 0)
    info = audit_result.get("low_count", 0)  # Info count if available

    summary_table.add_row("[red]Critical[/red]", str(critical))
    summary_table.add_row("[yellow]High[/yellow]", str(high))
    summary_table.add_row("[cyan]Medium[/cyan]", str(medium))
    summary_table.add_row("[blue]Low[/blue]", str(low))
    if info > 0:
        summary_table.add_row("[white]Info[/white]", str(info))

    console.print(summary_table)

    # Risk score
    risk_score = audit_result.get("overall_risk_score", 0)
    risk_status = audit_result.get("audit_status", "unknown")

    if risk_score >= 70:
        risk_color = "red"
        risk_text = "CRITICAL"
    elif risk_score >= 30:
        risk_color = "yellow"
        risk_text = "WARNING"
    else:
        risk_color = "green"
        risk_text = "SAFE"

    console.print(
        f"\n{CLIStyle.INFO} Overall Risk Score: [{risk_color}]{risk_score}/100 ({risk_text})[/{risk_color}]"
    )
    console.print(f"{CLIStyle.INFO} Audit Status: [{risk_color}]{risk_status}[/{risk_color}]")

    # Vulnerabilities list
    vulnerabilities = audit_result.get("vulnerabilities", [])
    if vulnerabilities:
        console.print(f"\n{CLIStyle.WARNING} Vulnerabilities Found:")

        # Group by severity
        by_severity = {"critical": [], "high": [], "medium": [], "low": [], "info": []}

        for vuln in vulnerabilities:
            severity = vuln.get("severity", "info").lower()
            if severity in by_severity:
                by_severity[severity].append(vuln)

        # Display by severity (most critical first)
        for severity in ["critical", "high", "medium", "low", "info"]:
            vulns = by_severity[severity]
            if vulns:
                severity_color = {
                    "critical": "red",
                    "high": "yellow",
                    "medium": "cyan",
                    "low": "blue",
                    "info": "white",
                }.get(severity, "white")

                console.print(
                    f"\n[{severity_color}]● {severity.upper()}: {len(vulns)} issues[/{severity_color}]"
                )

                for i, vuln in enumerate(vulns[:5], 1):  # Show top 5 per severity
                    title = vuln.get("title", "Unknown")
                    tool = vuln.get("tool", "unknown")
                    console.print(f"  {i}. [{severity_color}]{title}[/{severity_color}] ({tool})")

                if len(vulns) > 5:
                    console.print(f"  ... and {len(vulns) - 5} more")


def format_deployment_confirmation(deployment_data: Dict[str, Any]) -> None:
    """
    Format deployment confirmation display

    Concept: Display deployment details after successful deployment
    Logic:
        1. Create table with deployment information
        2. Display contract address prominently
        3. Show transaction details
        4. Display gas costs
    """
    table = Table(title="Deployment Confirmation")
    table.add_column("Field", style="cyan", width=25)
    table.add_column("Value", style="green")

    # Contract address (most important)
    contract_address = deployment_data.get("contract_address", "N/A")
    table.add_row("Contract Address", f"[bold green]{contract_address}[/bold green]")

    # Transaction hash
    tx_hash = deployment_data.get("transaction_hash", "N/A")
    table.add_row("Transaction Hash", tx_hash)

    # Network
    network = deployment_data.get("deployment_network", "N/A")
    table.add_row("Network", network)

    # Block number
    block_number = deployment_data.get("block_number")
    if block_number:
        table.add_row("Block Number", str(block_number))

    # Gas information
    gas_used = deployment_data.get("gas_used")
    if gas_used:
        table.add_row("Gas Used", f"{gas_used:,}")

    gas_price = deployment_data.get("gas_price")
    if gas_price:
        table.add_row("Gas Price", f"{gas_price:,} Wei")

    total_cost_eth = deployment_data.get("total_cost_eth")
    if total_cost_eth:
        table.add_row("Total Cost", f"{total_cost_eth:.6f} ETH")

    # Deployment status
    status = deployment_data.get("deployment_status", "unknown")
    status_color = "green" if status == "confirmed" else "yellow"
    table.add_row("Status", f"[{status_color}]{status}[/{status_color}]")

    # EigenDA commitment (if Mantle)
    eigenda_commitment = deployment_data.get("eigenda_commitment")
    if eigenda_commitment:
        table.add_row("EigenDA Commitment", eigenda_commitment)

    console.print(table)

    # Success message
    console.print(f"\n{CLIStyle.SUCCESS} Contract deployed successfully!")
    console.print(
        f"{CLIStyle.INFO} View on explorer: [link]https://explorer.hyperion.metis.io/address/{contract_address}[/link]"
    )


def format_test_results(test_results: Dict[str, Any]) -> None:
    """
    Format test results display

    Concept: Display compilation and test results
    Logic:
        1. Show compilation status
        2. Display test counts
        3. Show coverage if available
    """
    table = Table(title="Test Results")
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="green")

    # Compilation
    compilation_success = test_results.get("compilation_successful", False)
    comp_status = "[green]Success[/green]" if compilation_success else "[red]Failed[/red]"
    table.add_row("Compilation", comp_status)

    # Test framework
    framework = test_results.get("test_framework", "unknown")
    table.add_row("Framework", framework)

    # Test counts
    test_data = test_results.get("test_results", {})
    total = test_data.get("total", 0)
    passed = test_data.get("passed", 0)
    failed = test_data.get("failed", 0)

    table.add_row("Total Tests", str(total))
    table.add_row("Passed", f"[green]{passed}[/green]")
    table.add_row("Failed", f"[red]{failed}[/red]")

    # Coverage
    coverage = test_results.get("coverage", {})
    if coverage:
        line_cov = coverage.get("line_coverage", 0)
        branch_cov = coverage.get("branch_coverage", 0)

        table.add_row("Line Coverage", f"{line_cov:.1f}%")
        table.add_row("Branch Coverage", f"{branch_cov:.1f}%")

    console.print(table)

    # Overall status
    if failed == 0 and compilation_success:
        console.print(f"\n{CLIStyle.SUCCESS} All tests passed!")
    elif not compilation_success:
        console.print(f"\n{CLIStyle.ERROR} Compilation failed")
    else:
        console.print(f"\n{CLIStyle.WARNING} {failed} test(s) failed")


def format_progress_bar(current: int, total: int, label: str = "Progress") -> Progress:
    """
    Create a progress bar for long-running operations

    Concept: Visual progress indicator
    Logic:
        1. Create Rich Progress instance
        2. Add task with total
        3. Update as work progresses
    """
    progress = Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    )

    return progress


def format_unicode_progress_bar(
    progress: int, total: int = 100, width: int = 40, stage: str = "", label: str = "Progress"
) -> str:
    """
    Create Unicode progress bar following ASCII design rules

    Uses Unicode block characters (█) for filled portion
    Uses light shade (░) for empty portion
    Format: [Stage      ] |████████░░░░░░░░░░| 30%
    """
    if progress < 0:
        progress = 0
    if progress > total:
        progress = total

    filled = int((progress / total) * width)
    empty = width - filled

    filled_char = "█"
    empty_char = "░"

    bar = filled_char * filled + empty_char * empty
    percent = int((progress / total) * 100)

    if stage:
        return f"[{stage:12}] |{bar}| {percent:3}%"
    else:
        return f"[{label:12}] |{bar}| {percent:3}%"


def format_progress_bar_windows_safe(
    progress: int, total: int = 100, width: int = 40, stage: str = "", label: str = "Progress"
) -> str:
    """
    Create ASCII progress bar for Windows compatibility

    Uses ASCII characters (#) for filled portion
    Uses ASCII characters (-) for empty portion
    Format: [Stage      ] |####################----------| 50%
    """
    import platform

    if progress < 0:
        progress = 0
    if progress > total:
        progress = total

    filled = int((progress / total) * width)
    empty = width - filled

    # Use ASCII on Windows, Unicode on other platforms
    if platform.system() == "Windows":
        filled_char = "#"
        empty_char = "-"
    else:
        filled_char = "█"
        empty_char = "░"

    bar = filled_char * filled + empty_char * empty
    percent = int((progress / total) * 100)

    if stage:
        return f"[{stage:12}] |{bar}| {percent:3}%"
    else:
        return f"[{label:12}] |{bar}| {percent:3}%"


def get_stage_name(status: str) -> str:
    """Map workflow status to human-readable stage name"""
    stage_map = {
        "created": "Initializing",
        "generating": "Generating",
        "compiling": "Compiling",
        "auditing": "Auditing",
        "testing": "Testing",
        "deploying": "Deploying",
        "completed": "Completed",
        "failed": "Failed",
    }
    return stage_map.get(status, status.title())


def format_error(
    error_message: str, details: Optional[str] = None, suggestions: Optional[List[str]] = None
) -> None:
    """
    Format error message display with suggestions

    Concept: Display errors in a clear, readable format with actionable suggestions
    Logic:
        1. Show error message prominently
        2. Include details if available
        3. Show suggestions if provided
        4. Use error styling
    """
    panel_content = f"[red]{CLIStyle.ERROR} {error_message}[/red]"

    if details:
        panel_content += f"\n\n[dim]{details}[/dim]"

    if suggestions:
        panel_content += f"\n\n[yellow]{CLIStyle.INFO} Suggestions:[/yellow]"
        for i, suggestion in enumerate(suggestions, 1):
            panel_content += f"\n  {i}. {suggestion}"

    panel = Panel(panel_content, title="[bold red]Error[/bold red]", border_style="red")

    console.print(panel)


def handle_api_error(e, context: str = ""):
    """Handle API errors with helpful suggestions"""
    import httpx

    status = e.response.status_code
    error_data = {}
    try:
        if e.response.headers.get("content-type", "").startswith("application/json"):
            error_data = e.response.json()
    except:
        pass

    if status == 404:
        format_error(
            f"Resource not found: {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                "Check if the resource ID is correct",
                "List available resources: hyperagent workflow list",
                "Verify API is running: hyperagent system health",
            ],
        )
    elif status == 400:
        format_error(
            f"Invalid request: {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                "Check required parameters",
                "Validate input format",
                "See help: hyperagent workflow create --help",
            ],
        )
    elif status == 401:
        format_error(
            f"Authentication failed: {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                "Check your API credentials",
                "Verify authentication token is valid",
                "Re-authenticate if needed",
            ],
        )
    elif status == 403:
        format_error(
            f"Access forbidden: {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                "Check your permissions",
                "Verify you have access to this resource",
                "Contact administrator if needed",
            ],
        )
    elif status == 500:
        format_error(
            f"Server error: {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                "The server encountered an error",
                "Try again in a few moments",
                "Check server logs if problem persists",
                "Report issue if it continues",
            ],
        )
    else:
        format_error(
            f"API error ({status}): {context}",
            error_data.get("detail", str(e)),
            suggestions=[
                f"HTTP status: {status}",
                "Check API documentation",
                "Verify request format",
            ],
        )


def format_success(message: str, details: Optional[str] = None) -> None:
    """
    Format success message display

    Concept: Display success messages clearly
    """
    panel_content = f"[green]{CLIStyle.SUCCESS} {message}[/green]"
    if details:
        panel_content += f"\n\n[dim]{details}[/dim]"

    panel = Panel(panel_content, title="[bold green]Success[/bold green]", border_style="green")

    console.print(panel)
