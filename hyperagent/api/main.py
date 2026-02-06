"""FastAPI main application"""

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from hyperagent.api.middleware.rate_limit import RateLimiter, RateLimitMiddleware
from hyperagent.api.middleware.security import (
    InputSanitizationMiddleware,
    SecurityHeadersMiddleware,
)
from hyperagent.api.routes import (
    agents,
    auth,
    contracts,
    deployments,
    health,
    logs,
    metrics,
    networks,
    templates,
    workflows,
)
from hyperagent.api.routes.contracts.interact import router as contract_interact
from hyperagent.api.routes.x402 import analytics as x402_analytics
from hyperagent.api.routes.x402 import contracts as x402_contracts
from hyperagent.api.routes.x402 import deployments as x402_deployments
from hyperagent.api.routes.x402 import spending_controls as x402_spending_controls
from hyperagent.api.routes.x402 import workflows as x402_workflows
from hyperagent.api.websocket import websocket_endpoint
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.api.routes import app_index

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI Agent Platform for On-Chain Smart Contract Generation",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    contact={"name": "HyperAgent Team", "email": "info@hyperagent.dev"},
    license_info={"name": "MIT License", "url": "https://opensource.org/licenses/MIT"},
)

# Security headers middleware (add first to apply to all responses)
app.add_middleware(SecurityHeadersMiddleware)

# Input sanitization middleware
app.add_middleware(InputSanitizationMiddleware)

# CORS middleware
# Parse CORS origins from settings
cors_origins_str = getattr(settings, "cors_origins", "*")
if cors_origins_str == "*":
    # Default to common development origins when "*" is specified
    # Note: "*" cannot be used with allow_credentials=True
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]
else:
    # Split comma-separated origins
    cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Rate limiting middleware (if enabled)
if getattr(settings, "enable_rate_limiting", False):
    # Redis is optional - RateLimiter has in-memory fallback
    redis_manager = RedisManager(settings.redis_url) if settings.redis_url else None
    rate_limiter = RateLimiter(redis_manager)
    app.add_middleware(RateLimitMiddleware, rate_limiter=rate_limiter)

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(workflows.router)
app.include_router(contracts.router)
app.include_router(contract_interact)  # Contract interaction API
app.include_router(deployments.router)
app.include_router(deployments.workflow_router)  # Workflow-specific deployment endpoints
app.include_router(templates.router)
app.include_router(networks.router)
app.include_router(metrics.router)
app.include_router(logs.router)
app.include_router(x402_contracts.router)
app.include_router(x402_deployments.router)
app.include_router(x402_workflows.router)
app.include_router(x402_spending_controls.router)
app.include_router(x402_analytics.router)
app.include_router(app_index.router)


# Health check routes are now in health.py router


@app.websocket("/ws/workflow/{workflow_id}")
async def websocket_workflow(websocket: WebSocket, workflow_id: str):
    """WebSocket endpoint for real-time workflow updates"""
    await websocket_endpoint(websocket, workflow_id)


@app.on_event("startup")
async def startup_validation():
    """Validate critical configuration on startup"""
    import logging

    from hyperagent.core.exceptions import ConfigurationError

    logger = logging.getLogger(__name__)
    
    # Start workflow cleanup task to handle stuck workflows
    from hyperagent.api.tasks.workflow_cleanup import start_cleanup_task
    start_cleanup_task()
    errors = []
    warnings = []

    # Validate required API keys
    if not settings.gemini_api_key and not settings.openai_api_key:
        errors.append("GEMINI_API_KEY or OPENAI_API_KEY must be configured")

    # Validate x402 configuration if enabled
    if settings.x402_enabled:
        if not settings.thirdweb_client_id:
            warnings.append("THIRDWEB_CLIENT_ID not configured - x402 payments may not work")
        if not settings.thirdweb_secret_key:
            warnings.append("THIRDWEB_SECRET_KEY not configured - x402 payments may not work")
        if not settings.thirdweb_server_wallet_address:
            warnings.append(
                "THIRDWEB_SERVER_WALLET_ADDRESS not configured - gasless deployments disabled"
            )
        if not settings.merchant_wallet_address:
            warnings.append("MERCHANT_WALLET_ADDRESS not configured - x402 payments may not work")

    # Validate network configuration
    from hyperagent.blockchain.network_features import NetworkFeatureManager

    enabled_networks = NetworkFeatureManager.list_networks()
    if not enabled_networks:
        warnings.append("No networks configured")

    # Check Redis availability (optional)
    if not settings.redis_url:
        logger.info("Redis not configured - using in-memory fallback for rate limiting and events")
    else:
        try:
            # Try to connect to Redis
            test_client = redis.from_url(settings.redis_url, decode_responses=True)
            await test_client.ping()
            await test_client.close()
            logger.info("Redis connection successful")
        except Exception as e:
            warnings.append(f"Redis connection failed: {e} - using in-memory fallback")
    
    # Check database connectivity (with Supabase -> Docker Postgres fallback)
    from hyperagent.db.session import engine
    from sqlalchemy import text
    try:
        # Test database connection with timeout
        logger.info("Testing database connection...")
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✓ Database connection successful")
    except Exception as e:
        # If primary connection fails, try Docker Postgres fallback
        if "supabase.co" in settings.database_url:
            logger.warning(f"✗ Primary database (Supabase) connection failed: {e}")
            logger.info("Attempting fallback to Docker Postgres...")
            
            try:
                # Import and reinitialize with Docker Postgres fallback
                # In Docker, use service name 'postgres' instead of 'localhost'
                from sqlalchemy.ext.asyncio import create_async_engine
                fallback_url = "postgresql+asyncpg://hyperagent_user:secure_password@postgres:5432/hyperagent_db"
                test_engine = create_async_engine(fallback_url, pool_pre_ping=True)
                
                async with test_engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                
                await test_engine.dispose()
                logger.info("✓ Successfully connected to Docker Postgres (fallback)")
                warnings.append("Using Docker Postgres fallback (Supabase unavailable)")
            except Exception as fallback_error:
                errors.append(f"Database connection failed (both primary and fallback): {fallback_error}")
        else:
            errors.append(f"Database connection failed: {e}")

    # Log warnings
    for warning in warnings:
        logger.warning(f"Configuration warning: {warning}")

    # Raise errors if critical
    if errors:
        error_msg = "Critical configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(error_msg)
        # Don't raise in startup - just log (allows graceful degradation)
        # In production, you might want to raise ConfigurationError here

    logger.info("Startup validation complete")


# Exception handlers for custom exceptions
from fastapi import Request
from fastapi.responses import JSONResponse

from hyperagent.core.exceptions import (
    DeploymentError,
    HyperAgentError,
    NetworkError,
    RateLimitError,
    ValidationError,
    WalletError,
)


@app.exception_handler(HyperAgentError)
async def hyperagent_error_handler(request: Request, exc: HyperAgentError):
    """Handle HyperAgent custom exceptions"""
    status_code_map = {
        DeploymentError: 500,
        NetworkError: 503,
        WalletError: 400,
        ValidationError: 400,
        RateLimitError: 429,
        HyperAgentError: 500,
    }
    status_code = status_code_map.get(type(exc), 500)

    return JSONResponse(status_code=status_code, content=exc.to_dict())
