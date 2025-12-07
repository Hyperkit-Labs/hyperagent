"""Interactive CLI prompts for workflow creation"""

import click

from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager
from hyperagent.cli.formatters import CLIStyle, console


def get_network_features_preview(network: str) -> str:
    """Get a brief preview of network features"""
    try:
        features = NetworkFeatureManager.get_features(network)
        available = sum(1 for f, supported in features.items() if supported)
        total = len(features)
        return f"{available}/{total} features"
    except:
        return "features available"


def run_interactive_prompts():
    """Run interactive prompts for workflow creation"""
    console.print(f"\n{CLIStyle.INFO} Interactive Workflow Creation")
    console.print(f"{CLIStyle.INFO} Press Ctrl+C to cancel\n")

    # Description (multi-line support)
    console.print(f"{CLIStyle.PROGRESS} Contract Description:")
    console.print(f"{CLIStyle.INFO} (Enter description, press Enter twice to finish)")
    description_lines = []
    while True:
        try:
            line = input()
            if not line and description_lines:
                break
            if line:
                description_lines.append(line)
        except (EOFError, KeyboardInterrupt):
            console.print(f"\n{CLIStyle.WARNING} Cancelled by user")
            raise click.Abort()

    if not description_lines:
        raise click.ClickException("Description cannot be empty")

    description = "\n".join(description_lines)

    # Network selection with feature preview
    console.print(f"\n{CLIStyle.PROGRESS} Select Network:")
    networks = ["hyperion_testnet", "hyperion_mainnet", "mantle_testnet", "mantle_mainnet"]
    for i, net in enumerate(networks, 1):
        features = get_network_features_preview(net)
        console.print(f"  {i}. {net} ({features})")

    network_choice = click.prompt("Network", type=click.IntRange(1, len(networks)), default=1)
    network = networks[network_choice - 1]

    # Contract type
    console.print(f"\n{CLIStyle.PROGRESS} Contract Type:")
    types = ["ERC20", "ERC721", "ERC1155", "Custom"]
    for i, t in enumerate(types, 1):
        console.print(f"  {i}. {t}")
    type_choice = click.prompt("Type", type=click.IntRange(1, len(types)), default=4)
    contract_type = types[type_choice - 1]

    # Options (checkboxes)
    console.print(f"\n{CLIStyle.PROGRESS} Options:")
    skip_audit = not click.confirm("Run security audit?", default=True)
    skip_deploy = not click.confirm("Deploy to blockchain?", default=True)
    optimize_metisvm = click.confirm("Optimize for MetisVM?", default=False)
    enable_fp = click.confirm("Enable floating-point?", default=False)
    enable_ai = click.confirm("Enable AI inference?", default=False)

    return (
        description,
        network,
        contract_type,
        {
            "skip_audit": skip_audit,
            "skip_deployment": skip_deploy,
            "optimize_metisvm": optimize_metisvm,
            "enable_fp": enable_fp,
            "enable_ai": enable_ai,
        },
    )
