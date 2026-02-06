"""
Agent Capabilities Registry

This module is planned for future implementation.
Feature flag: ENABLE_CAPABILITIES (default: false)

When enabled, this will provide:
- Dynamic capability discovery
- Plugin system for agents
- Capability-based routing
"""

from hyperagent.core.feature_flags import is_capabilities_enabled

# Runtime feature flag check
ENABLED = is_capabilities_enabled()

__all__ = ["ENABLED"]

