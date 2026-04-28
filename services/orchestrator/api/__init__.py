"""
Orchestrator API routers. Mount in main.py:

  from api import (
      pipeline_router,
      workflows_router,
      workflows_streaming_router,
      credits_router,
      payments_router,
      pricing_router,
      ui_export_router,
      health_router,
      api_health_router,
      config_router,
      metrics_router,
  )
  app.include_router(pipeline_router)
  app.include_router(workflows_router)
  app.include_router(workflows_streaming_router)
  app.include_router(credits_router)
  app.include_router(payments_router)
  app.include_router(pricing_router)
  app.include_router(ui_export_router)
  app.include_router(health_router)
  app.include_router(api_health_router)
  app.include_router(config_router)
  app.include_router(metrics_router)
"""

from .billing import (
    credits_router,
    payments_router,
    pricing_router,
    reconciliation_router,
)
from .infra import router as infra_router
from .metrics_health import (
    api_health_router,
    config_router,
    health_router,
    identity_router,
    metrics_router,
)
from .pipeline import router as pipeline_router
from .runs_registry import (
    agents_router,
    approve_spec_legacy_router,
    contracts_router,
    debug_sandbox_router,
    llm_keys_router,
    logs_router,
    registry_router,
    runs_router,
    sandbox_router,
    security_router,
)
from .simulation_webhooks import router as simulation_webhooks_router
from .storage_webhooks import router as storage_webhooks_router
from .ui_export import router as ui_export_router
from .workflows import router as workflows_router
from .workflows import streaming_router as workflows_streaming_router
from .x402_webhooks import router as x402_webhooks_router

__all__ = [
    "agents_router",
    "approve_spec_legacy_router",
    "config_router",
    "contracts_router",
    "credits_router",
    "debug_sandbox_router",
    "health_router",
    "api_health_router",
    "identity_router",
    "infra_router",
    "llm_keys_router",
    "logs_router",
    "metrics_router",
    "payments_router",
    "pipeline_router",
    "pricing_router",
    "reconciliation_router",
    "registry_router",
    "runs_router",
    "sandbox_router",
    "security_router",
    "simulation_webhooks_router",
    "storage_webhooks_router",
    "ui_export_router",
    "workflows_router",
    "workflows_streaming_router",
    "x402_webhooks_router",
]
