"""
Telemetry and Observability

This module is planned for future implementation.
Feature flag: ENABLE_TELEMETRY (default: false)

When enabled, this will provide:
- Distributed tracing
- Performance metrics
- Error tracking
- Usage analytics
"""

from hyperagent.core.feature_flags import is_telemetry_enabled

# Runtime feature flag check
ENABLED = is_telemetry_enabled()

__all__ = ["ENABLED"]

