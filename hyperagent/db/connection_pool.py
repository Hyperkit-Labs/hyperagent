"""
Database Connection Pool

Concept: Efficient database connection management
Logic: Connection pooling, query optimization, connection reuse
"""

import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, QueuePool

from hyperagent.core.config import settings

logger = logging.getLogger(__name__)


class DatabasePool:
    """
    Database Connection Pool Manager

    Concept: Manage database connections efficiently
    Logic: Create pool, reuse connections, optimize queries
    """

    def __init__(self, database_url: str = None):
        self.database_url = database_url or settings.database_url
        self.engine = None
        self.session_factory = None

    def initialize(self, pool_size: int = 20, max_overflow: int = 10):
        """
        Initialize connection pool

        Args:
            pool_size: Number of connections to maintain
            max_overflow: Maximum overflow connections
        """
        # Use connection pooling for better performance
        self.engine = create_async_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,  # Recycle connections after 1 hour
            echo=False,  # Set to True for SQL logging
            future=True,
        )

        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )

        logger.info(
            f"Database connection pool initialized (size={pool_size}, overflow={max_overflow})"
        )

    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Get database session from pool

        Usage:
            async with db_pool.get_session() as session:
                result = await session.execute(query)
        """
        if not self.session_factory:
            self.initialize()

        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def close(self):
        """Close all connections in pool"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connection pool closed")


# Global database pool instance
db_pool = DatabasePool()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI to get database session

    Usage:
        @router.get("/endpoint")
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    async for session in db_pool.get_session():
        yield session
