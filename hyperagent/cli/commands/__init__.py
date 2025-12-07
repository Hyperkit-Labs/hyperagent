"""CLI command modules"""

from hyperagent.cli.commands.contract import register_contract_commands
from hyperagent.cli.commands.deployment import register_deployment_commands
from hyperagent.cli.commands.system import (
    register_config_group,
    register_system_commands,
)
from hyperagent.cli.commands.template import register_template_commands
from hyperagent.cli.commands.workflow import register_workflow_commands

__all__ = [
    "register_contract_commands",
    "register_deployment_commands",
    "register_system_commands",
    "register_config_group",
    "register_template_commands",
    "register_workflow_commands",
]
