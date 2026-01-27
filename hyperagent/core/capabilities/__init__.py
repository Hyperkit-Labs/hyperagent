"""
Agent Capabilities Registry

This module is planned for future implementation.
Feature flag: ENABLE_CAPABILITIES (default: false)

When enabled, this will provide:
- Dynamic capability discovery
- Plugin system for agents
- Capability-based routing
"""

# Feature flag check
import os
ENABLED = os.getenv("ENABLE_CAPABILITIES", "false").lower() == "true"

__all__ = ["ENABLED"]

