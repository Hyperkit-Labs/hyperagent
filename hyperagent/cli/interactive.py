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

    # Wallet address (required)
    console.print(f"\n{CLIStyle.PROGRESS} Wallet Address:")
    console.print(f"{CLIStyle.INFO} (Required for all workflows - format: 0x followed by 40 hex characters)")
    wallet_address = click.prompt("Wallet Address", type=str)
    
    # Validate wallet address format
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise click.ClickException(
            f"Invalid wallet address format. Expected 0x followed by 40 hexadecimal characters, got {len(wallet_address)} characters"
        )

    # Network selection with feature preview
    console.print(f"\n{CLIStyle.PROGRESS} Select Network:")

    # Load from config-driven registry
    from hyperagent.blockchain.network_features import NetworkFeatureManager

    networks = NetworkFeatureManager.list_networks()
    if not networks:
        raise click.ClickException("No networks configured. Check config/networks.yaml")

    # Prefer mantle_testnet as default when present
    default_index = 1
    if "mantle_testnet" in networks:
        default_index = networks.index("mantle_testnet") + 1

    for i, net in enumerate(networks, 1):
        features = get_network_features_preview(net)
        console.print(f"  {i}. {net} ({features})")

    network_choice = click.prompt(
        "Network", type=click.IntRange(1, len(networks)), default=default_index
    )
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

    return (
        description,
        network,
        contract_type,
        wallet_address,
        {
            "skip_audit": skip_audit,
            "skip_deployment": skip_deploy,
        },
    )
