"""Service discovery: env-driven URLs. Re-exports canonical_env for a single owner."""

from __future__ import annotations

from canonical_env import SERVICE_URL_MAP as SERVICES
from canonical_env import get_service_url, is_production

IS_PRODUCTION = is_production()
