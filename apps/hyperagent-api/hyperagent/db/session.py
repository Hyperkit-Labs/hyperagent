"""Database session management with automatic Supabase -> Local Postgres fallback"""

import logging
import socket
from typing import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)

# Global variable to track which database we're using
_active_database_url: str = None
_engine_initialized: bool = False


def _test_dns_resolution(hostname: str, timeout: int = 2) -> bool:
    """Test if a hostname can be resolved (DNS check)"""
    try:
        socket.setdefaulttimeout(timeout)
        socket.gethostbyname(hostname)
        return True
    except (socket.gaierror, socket.timeout) as e:
        logger.debug(f"DNS resolution failed for {hostname}: {e}")
        return False


def _extract_hostname_from_db_url(db_url: str) -> str:
    """Extract hostname from database URL"""
    try:
        # Parse URL to extract hostname
        # Format: postgresql://user:pass@hostname:port/database
        parsed = urlparse(db_url)
        return parsed.hostname
    except Exception as e:
        logger.error(f"Failed to parse database URL: {e}")
        return None


def _get_fallback_database_url() -> str:
    """
    Determine which database URL to use with automatic fallback
    Uses DNS resolution test (fast, synchronous)
    Returns: Database URL (with fallback applied if needed)
    """
    primary_url = settings.database_url
    fallback_url = "postgresql://hyperagent_user:secure_password@postgres:5432/hyperagent_db"
    
    # If Supabase URL is configured, test DNS resolution first
    if "supabase.co" in primary_url:
        hostname = _extract_hostname_from_db_url(primary_url)
        
        if hostname:
            logger.info(f"Primary database: Supabase ({hostname}) - testing DNS resolution...")
            
            # Test DNS resolution (fast, synchronous)
            if _test_dns_resolution(hostname, timeout=2):
                logger.info("✓ Supabase hostname resolved - using primary database")
                return primary_url
            else:
                logger.warning(f"✗ Supabase hostname '{hostname}' cannot be resolved - falling back to Docker Postgres")
                return fallback_url
        else:
            logger.error("Failed to extract hostname from Supabase URL - falling back to Docker Postgres")
            return fallback_url
    else:
        # Not Supabase, use as-is
        logger.info(f"Using configured database: {primary_url}")
        return primary_url


# Get the active database URL (with fallback if needed)
_active_database_url = _get_fallback_database_url()

# Create async engine based on active database URL
database_url = _active_database_url
if "pooler.supabase.com" in database_url or "pooler" in database_url or "supabase.co" in database_url:
    # For Supabase/pgbouncer: use psycopg (async) instead of asyncpg
    # psycopg doesn't use prepared statements by default, making it compatible with pgbouncer
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://")
    engine = create_async_engine(
        database_url,
        echo=False,
        poolclass=NullPool,  # pgbouncer handles pooling, don't pool at SQLAlchemy level
        connect_args={"timeout": 5, "connect_timeout": 5},  # Add connection timeout for faster fallback
    )
    logger.info("Database engine created: psycopg (Supabase/pgbouncer mode)")
else:
    # For direct connections, use asyncpg (faster)
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        connect_args={"timeout": 5},  # Add connection timeout
    )
    logger.info("Database engine created: asyncpg (direct connection mode)")

# Create session factory
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency for FastAPI

    Usage:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
