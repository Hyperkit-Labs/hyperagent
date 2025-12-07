"""Network configuration file loader

Concept: Load network configurations from JSON/YAML files
Logic: Parse config file, register networks dynamically
Benefits: Easy to add new networks without code changes
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

logger = logging.getLogger(__name__)


def load_network_config_file(config_path: str) -> Dict[str, Any]:
    """
    Load network configuration from JSON or YAML file

    Args:
        config_path: Path to configuration file

    Returns:
        Dictionary with network configurations

    Example JSON format:
    {
      "networks": {
        "ethereum_mainnet": {
          "chain_id": 1,
          "rpc_url": "https://eth.llamarpc.com",
          "explorer": "https://etherscan.io",
          "currency": "ETH",
          "features": {
            "pef": false,
            "metisvm": false,
            "eigenda": false,
            "batch_deployment": true,
            "floating_point": false,
            "ai_inference": false
          }
        }
      }
    }
    """
    config_file = Path(config_path)

    if not config_file.exists():
        raise FileNotFoundError(f"Network configuration file not found: {config_path}")

    # Determine file type
    if config_file.suffix in [".yaml", ".yml"]:
        with open(config_file, "r") as f:
            config_data = yaml.safe_load(f)
    elif config_file.suffix == ".json":
        with open(config_file, "r") as f:
            config_data = json.load(f)
    else:
        raise ValueError(f"Unsupported configuration file format: {config_file.suffix}")

    return config_data


def register_networks_from_config(config_path: str) -> List[str]:
    """
    Register networks from configuration file

    Concept: Load config file and register all networks
    Logic:
        1. Load configuration file
        2. Parse network definitions
        3. Register each network with NetworkFeatureManager
        4. Return list of registered network names

    Args:
        config_path: Path to network configuration file

    Returns:
        List of registered network names

    Raises:
        FileNotFoundError: If config file doesn't exist
        ValueError: If config format is invalid
    """
    config_data = load_network_config_file(config_path)

    if "networks" not in config_data:
        raise ValueError("Configuration file must contain 'networks' key")

    registered_networks = []

    for network_name, network_config in config_data["networks"].items():
        try:
            # Validate required fields
            required_fields = ["chain_id", "rpc_url", "features"]
            for field in required_fields:
                if field not in network_config:
                    raise ValueError(f"Network '{network_name}' missing required field: {field}")

            # Convert feature flags from dict to NetworkFeature enum
            features_dict = network_config.get("features", {})
            features = {}

            feature_mapping = {
                "pef": NetworkFeature.PEF,
                "metisvm": NetworkFeature.METISVM,
                "eigenda": NetworkFeature.EIGENDA,
                "batch_deployment": NetworkFeature.BATCH_DEPLOYMENT,
                "floating_point": NetworkFeature.FLOATING_POINT,
                "ai_inference": NetworkFeature.AI_INFERENCE,
            }

            for feature_key, feature_enum in feature_mapping.items():
                features[feature_enum] = features_dict.get(feature_key, False)

            # Register network
            NetworkFeatureManager.register_network(
                network_name=network_name,
                chain_id=network_config["chain_id"],
                rpc_url=network_config["rpc_url"],
                features=features,
                explorer=network_config.get("explorer"),
                currency=network_config.get("currency"),
            )

            registered_networks.append(network_name)
            logger.info(f"Registered network from config: {network_name}")

        except Exception as e:
            logger.error(f"Failed to register network '{network_name}': {e}")
            continue

    return registered_networks


def load_default_network_config() -> Optional[str]:
    """
    Load default network configuration file if it exists

    Looks for network config in:
    1. config/networks.json
    2. config/networks.yaml
    3. networks.json (project root)
    4. networks.yaml (project root)

    Returns:
        Path to config file if found, None otherwise
    """
    possible_paths = [
        Path("config/networks.json"),
        Path("config/networks.yaml"),
        Path("networks.json"),
        Path("networks.yaml"),
    ]

    for config_path in possible_paths:
        if config_path.exists():
            return str(config_path)

    return None
